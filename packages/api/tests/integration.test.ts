import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as docker from '../src/docker';

// Skip these tests if Docker is not available
const DOCKER_AVAILABLE = process.env.TEST_DOCKER === 'true';

describe.skipIf(!DOCKER_AVAILABLE)('Docker Integration Tests', () => {
  const TEST_SPACE_PREFIX = 'test-integration-';
  const testSpaces: string[] = [];

  // Helper to create a unique test space name
  const uniqueName = () => {
    const name = `${TEST_SPACE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    testSpaces.push(name);
    return name;
  };

  // Cleanup all test spaces after tests
  afterAll(async () => {
    for (const name of testSpaces) {
      try {
        await docker.destroySpace(name);
      } catch {
        // Space might already be destroyed
      }
    }
  });

  describe('Space Creation', () => {
    it('creates a space with default settings', async () => {
      const name = uniqueName();
      const space = await docker.createSpace(name);

      expect(space.name).toBe(name);
      expect(space.status).toBe('running');
      expect(space.cpus).toBe(1);
    });

    it('creates a space with custom memory and CPUs', async () => {
      const name = uniqueName();
      const space = await docker.createSpace(name, '1g', 0.5);

      expect(space.name).toBe(name);
      expect(space.memory).toBe(1 * 1024 * 1024 * 1024);
      expect(space.cpus).toBe(0.5);
    });
  });

  describe('Space Listing', () => {
    it('lists created spaces', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const spaces = await docker.listSpaces();
      const found = spaces.find(s => s.name === name);

      expect(found).toBeDefined();
      expect(found?.status).toBe('running');
    });
  });

  describe('Space Lifecycle', () => {
    it('stops and starts a space', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      // Stop
      await docker.stopSpace(name);
      let spaces = await docker.listSpaces();
      let space = spaces.find(s => s.name === name);
      expect(space?.status).toBe('paused');

      // Start
      await docker.startSpace(name);
      spaces = await docker.listSpaces();
      space = spaces.find(s => s.name === name);
      expect(space?.status).toBe('running');
    });

    it('destroys a space', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      await docker.destroySpace(name);

      const spaces = await docker.listSpaces();
      const found = spaces.find(s => s.name === name);
      expect(found).toBeUndefined();

      // Remove from cleanup list since already destroyed
      const idx = testSpaces.indexOf(name);
      if (idx > -1) testSpaces.splice(idx, 1);
    });
  });

  describe('Command Execution', () => {
    it('executes a simple command', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, 'echo hello');

      expect(result.stdout).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('executes a command with arguments', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, ['python3', '-c', 'print(1+1)']);

      expect(result.stdout).toBe('2');
      expect(result.exitCode).toBe(0);
    });

    it('captures stderr', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, 'echo error >&2');

      expect(result.stderr).toBe('error');
    });

    it('returns correct exit code on failure', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, 'exit 42');

      expect(result.exitCode).toBe(42);
    });

    it('auto-resumes paused space on exec', async () => {
      const name = uniqueName();
      await docker.createSpace(name);
      await docker.stopSpace(name);

      // Should auto-resume
      const result = await docker.execInSpace(name, 'echo resumed');

      expect(result.stdout).toBe('resumed');
      
      const spaces = await docker.listSpaces();
      const space = spaces.find(s => s.name === name);
      expect(space?.status).toBe('running');
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in commands', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, 'echo "hello world" | tr a-z A-Z');

      expect(result.stdout).toBe('HELLO WORLD');
    });

    it('handles multiline output', async () => {
      const name = uniqueName();
      await docker.createSpace(name);

      const result = await docker.execInSpace(name, 'echo -e "line1\\nline2\\nline3"');

      expect(result.stdout).toContain('line1');
      expect(result.stdout).toContain('line2');
      expect(result.stdout).toContain('line3');
    });
  });
});

describe('Memory Parsing', () => {
  it('parses gigabytes', () => {
    expect(docker.parseMemory('2g')).toBe(2 * 1024 * 1024 * 1024);
    expect(docker.parseMemory('4G')).toBe(4 * 1024 * 1024 * 1024);
  });

  it('parses megabytes', () => {
    expect(docker.parseMemory('512m')).toBe(512 * 1024 * 1024);
    expect(docker.parseMemory('256M')).toBe(256 * 1024 * 1024);
  });

  it('parses kilobytes', () => {
    expect(docker.parseMemory('1024k')).toBe(1024 * 1024);
  });

  it('defaults to 2GB for invalid input', () => {
    expect(docker.parseMemory('invalid')).toBe(2 * 1024 * 1024 * 1024);
    expect(docker.parseMemory('')).toBe(2 * 1024 * 1024 * 1024);
  });
});
