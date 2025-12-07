# Profiling

## Local development profiling

For local development profiling `cProfile` is currently used to analyze the performance of the API endpoints. The results are saved to the git-ignored `profiling` directory for the developer to manipulate them. Later on demand we can add a more sophisticated profiling tool and persist the results.

### Commands

#### Profile API endpoints

```bash
# course-id param for course-detail endpoints
python manage.py profile_api --course-id <course_id>
```

Results:

- `profile_results.json` - JSON file with the profiling results
- `cprofile_output.txt` - Text file with the profiling output

Files paths are configured in `settings/dev.py`.
