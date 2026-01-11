# Clawdspace Sandbox Image
# A minimal Ubuntu environment for code execution

FROM ubuntu:24.04

# Install common development tools
RUN apt-get update && apt-get install -y \
    # Basic utilities
    curl wget git vim nano ca-certificates \
    # Build tools
    build-essential \
    # Python
    python3 python3-pip python3-venv \
    # Node.js
    nodejs npm \
    # System tools
    jq htop tmux \
    # GitHub CLI (gh)
    gh \
    # Cleanup
    && rm -rf /var/lib/apt/lists/*

# Create sandbox user (non-root)
# Use deterministic UID/GID so host volume init can chown reliably.
RUN groupadd -g 1001 sandbox && useradd -m -u 1001 -g 1001 -s /bin/bash sandbox

# Force bash history into the workspace volume so we can audit interactive sessions.
# Notes:
# - We use HISTTIMEFORMAT so each line has an epoch timestamp prefix.
# - Interactive shell must be bash for this to apply.
ENV HISTFILE=/workspace/.bash_history \
    HISTSIZE=100000 \
    HISTFILESIZE=200000 \
    HISTCONTROL=ignoreboth \
    HISTTIMEFORMAT='%s '

RUN mkdir -p /workspace && chown -R 1001:1001 /workspace \
  && printf '%s\n' \
    'export HISTFILE=/workspace/.bash_history' \
    'export HISTSIZE=100000' \
    'export HISTFILESIZE=200000' \
    'export HISTCONTROL=ignoreboth' \
    "export HISTTIMEFORMAT='%s '" \
    'shopt -s histappend' \
    'export PROMPT_COMMAND="history -a; history -n; ${PROMPT_COMMAND}"' \
    > /etc/profile.d/clawdspace_history.sh

# Switch to sandbox user
USER sandbox
WORKDIR /workspace

# Keep container running
CMD ["sleep", "infinity"]
