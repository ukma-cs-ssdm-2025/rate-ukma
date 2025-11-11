# Testing GitHub Workflows

## Act

Act is a tool that allows you to test GitHub workflows locally.

**Under the hood**: Act uses Docker to run the workflow in a container.

### Copy configuration files

```bash
cp .act.secrets.sample .act.secrets
cp .actrc.sample .actrc
```

### Run workflow

```bash
cd /path/to/repo/root
act [trigger] -W .github/workflows/job-name.yml --input your-input-name=your-input-value
```

--env vars will be passed from .actrc file

*WIP: instructions for installation and usage*
