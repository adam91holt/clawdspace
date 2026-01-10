# Clawdspace API Documentation

## Base URL

```
http://your-server:7777/api
```

## Authentication

All API requests require a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" http://localhost:7777/api/spaces
```

---

## Spaces

### List Spaces

```http
GET /api/spaces
```

**Response:**
```json
{
  "spaces": [
    {
      "name": "my-space",
      "id": "abc123def456",
      "status": "running",
      "created": "2024-01-10T10:00:00Z",
      "started": "2024-01-10T10:00:01Z",
      "image": "clawdspace:latest",
      "memory": 2147483648,
      "cpus": 1,
      "lastActivity": "2024-01-10T10:05:00Z"
    }
  ]
}
```

### Create Space

```http
POST /api/spaces
```

**Request Body:**
```json
{
  "name": "my-space",
  "memory": "2g",
  "cpus": 1,
  "gpu": false,
  "image": "clawdspace:latest"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | required | Alphanumeric, dashes, underscores |
| `memory` | string | `"2g"` | Memory limit (e.g., "512m", "4g") |
| `cpus` | number | `1` | CPU cores |
| `gpu` | boolean | `false` | Enable GPU passthrough |
| `image` | string | auto | Docker image (auto-selects PyTorch for GPU) |

**Response:**
```json
{
  "space": {
    "name": "my-space",
    "id": "abc123def456",
    "status": "running",
    ...
  }
}
```

### Get Space

```http
GET /api/spaces/:name
```

### Delete Space

```http
DELETE /api/spaces/:name
```

### Stop (Pause) Space

```http
POST /api/spaces/:name/stop
```

Pauses the container. No CPU usage while paused.

### Start (Resume) Space

```http
POST /api/spaces/:name/start
```

Resumes a paused container.

### Execute Command

```http
POST /api/spaces/:name/exec
```

**Request Body:**
```json
{
  "command": "python3 --version"
}
```

Or as array:
```json
{
  "command": ["python3", "-c", "print('hello')"]
}
```

**Response:**
```json
{
  "stdout": "Python 3.12.0\n",
  "stderr": "",
  "exitCode": 0
}
```

---

## System

### Get System Info

```http
GET /api/system
```

**Response:**
```json
{
  "hostname": "my-server",
  "platform": "linux",
  "arch": "x64",
  "cpus": 12,
  "loadAverage": [0.5, 0.3, 0.2],
  "memory": {
    "total": "24.0 GB",
    "free": "18.0 GB",
    "used": "6.0 GB",
    "percentage": "25.0%"
  },
  "disk": {
    "total": "500G",
    "used": "200G",
    "available": "300G",
    "percentage": "40%"
  },
  "uptime": "5d 3h 20m",
  "docker": {
    "version": "24.0.0",
    "containers": 10,
    "containersRunning": 5,
    "containersPaused": 2,
    "images": 15
  },
  "capabilities": {
    "gpu": true,
    "gpuName": "NVIDIA GeForce RTX 3090",
    "gpuMemory": "24576 MiB",
    "arch": "x64",
    "platform": "linux"
  }
}
```

### Get Capabilities Only

```http
GET /api/system/capabilities
```

**Response:**
```json
{
  "gpu": true,
  "gpuName": "NVIDIA GeForce RTX 3090",
  "gpuMemory": "24576 MiB",
  "arch": "x64",
  "platform": "linux",
  "cpus": 12,
  "memory": 25769803776
}
```

### Health Check

```http
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## Error Responses

All errors return:

```json
{
  "error": "Error message here"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid input) |
| 401 | Unauthorized (invalid/missing API key) |
| 404 | Space not found |
| 409 | Conflict (space already exists) |
| 500 | Server error |

---

## Examples

### Create a GPU Space for ML

```bash
curl -X POST http://localhost:7777/api/spaces \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "ml-training", "memory": "16g", "cpus": 8, "gpu": true}'
```

### Run PyTorch Training

```bash
curl -X POST http://localhost:7777/api/spaces/ml-training/exec \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "python3 train.py --epochs 100"}'
```

### Check GPU Availability

```bash
curl -X POST http://localhost:7777/api/spaces/ml-training/exec \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command": "python3 -c \"import torch; print(torch.cuda.is_available())\""}'
```
