# Clawdspace CLI Documentation

## Installation

```bash
# Copy the CLI to your path
cp packages/cli/clawdspace /usr/local/bin/
chmod +x /usr/local/bin/clawdspace
```

## Configuration

Create `~/.clawdspace`:

```bash
# API Key
CLAWDSPACE_KEY="your_api_key"

# Known hosts to probe for auto-discovery
CLAWDSPACE_HOSTS="192.168.1.100 my-server.local oracle"
```

## Commands

### servers

List and discover available Clawdspace servers.

```bash
clawdspace servers              # List from cache
clawdspace servers --refresh    # Rescan network
```

**Output:**
```
NAME         URL                          STATUS   RESOURCES            CAPABILITIES
----         ---                          ------   ---------            ------------
oracle       http://100.67.131.19:7777    online   4cpu, 4.5%, arm64    
rtx3090      http://100.64.248.29:7777    online   12cpu, 28%, x64      🎮 3090
```

### create

Create a new space.

```bash
clawdspace create <name> [options]
```

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| `--server, -s` | Target server | Auto-select |
| `--memory, -m` | Memory limit | `2g` |
| `--cpus, -c` | CPU cores | `1` |
| `--gpu, -g` | Enable GPU (auto-selects GPU server) | `false` |

**Examples:**
```bash
# Basic space
clawdspace create dev

# Custom resources
clawdspace create worker --memory 4g --cpus 2

# GPU-enabled space (auto-selects GPU server + PyTorch image)
clawdspace create ml-training --gpu --memory 16g --cpus 8

# Specific server
clawdspace create build --server oracle
```

### list

List all spaces across all servers.

```bash
clawdspace list                 # All servers
clawdspace list --server oracle # Specific server
```

**Output:**
```
NAME         SERVER       STATUS       RESOURCES
----         ------       ------       ---------
dev          oracle       running      1cpu, 2.0GB
ml-training  rtx3090      running      8cpu, 16.0GB
worker       oracle       paused       2cpu, 4.0GB
```

### exec

Execute a command in a space.

```bash
clawdspace exec <name> <command>
```

**Examples:**
```bash
# Simple command
clawdspace exec dev "ls -la"

# Python
clawdspace exec dev "python3 --version"

# Complex command
clawdspace exec dev "cd /app && npm install && npm test"

# GPU check
clawdspace exec ml-training "python3 -c 'import torch; print(torch.cuda.is_available())'"
```

### stop

Pause a space (saves CPU, preserves state).

```bash
clawdspace stop <name>
```

### start

Resume a paused space.

```bash
clawdspace start <name>
```

### destroy

Delete a space permanently.

```bash
clawdspace destroy <name>       # With confirmation
clawdspace destroy <name> -f    # Force, no confirmation
```

### system

Show server system information.

```bash
clawdspace system                    # Default server
clawdspace system --server rtx3090   # Specific server
```

**Output:**
```
System Status (rtx3090):

  Hostname:   rtx3090
  Platform:   linux (x64)
  CPUs:       12
  Load:       0.15
  Memory:     28.5% (6.8 GB / 23.4 GB)
  Disk:       45% (450G / 1.0T)
  Uptime:     5d 3h 20m
  Containers: 3 running
```

### config

Show current configuration.

```bash
clawdspace config
```

---

## Auto-Discovery

Clawdspace automatically discovers servers on your network by:

1. Probing known hosts (from `CLAWDSPACE_HOSTS`)
2. Checking each for Clawdspace API on port 7777
3. Caching results for 5 minutes

**To add new servers:**
```bash
echo 'CLAWDSPACE_HOSTS="192.168.1.100 192.168.1.101 my-server"' >> ~/.clawdspace
clawdspace servers --refresh
```

---

## GPU Workflows

### Check Available GPU Servers

```bash
clawdspace servers --refresh
# Look for 🎮 in CAPABILITIES column
```

### Create GPU Space

```bash
# Auto-selects first server with GPU
clawdspace create training --gpu --memory 16g

# Uses PyTorch image by default
# Passes --gpus all to Docker
```

### Run ML Training

```bash
clawdspace exec training "python3 train.py --epochs 100"
```

### Monitor GPU Usage

```bash
clawdspace exec training "nvidia-smi"
```

---

## Tips

### Long-Running Tasks

For long tasks, consider:
```bash
# Start in background
clawdspace exec worker "nohup python3 train.py > output.log 2>&1 &"

# Check later
clawdspace exec worker "tail -f output.log"
```

### Interactive Sessions

For interactive work, exec into the container directly:
```bash
# Get container name
clawdspace list

# SSH to server and docker exec
ssh my-server
docker exec -it clawdspace-myspace /bin/bash
```

### Resource Limits

Default limits per space:
- Memory: 2GB
- CPUs: 1 core
- Storage: Shared with host

Adjust with `--memory` and `--cpus` flags.
