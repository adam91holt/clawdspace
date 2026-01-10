# Clawdspace Sandbox Image
# A minimal Ubuntu environment for code execution

FROM ubuntu:24.04

# Install common development tools
RUN apt-get update && apt-get install -y \
    # Basic utilities
    curl wget git vim nano \
    # Build tools
    build-essential \
    # Python
    python3 python3-pip python3-venv \
    # Node.js
    nodejs npm \
    # System tools
    jq htop tmux \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user (non-root)
RUN useradd -m -s /bin/bash sandbox

# Switch to sandbox user
USER sandbox
WORKDIR /home/sandbox

# Keep container running
CMD ["sleep", "infinity"]
