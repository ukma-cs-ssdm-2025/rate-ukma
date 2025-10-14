# Bandit Static Analysis

Run started:2025-10-11 08:19:53.222456

Test results:

> > Issue: [B105:hardcoded_password_string] Possible hardcoded password: 'django-insecure-k)(flx8*!5_w*mzv77nrkumbzy08!i)v-u_93mcq#bkl%%p$6f'
> > Severity: Low Confidence: Medium
> > CWE: CWE-259 (https://cwe.mitre.org/data/definitions/259.html)
> > More Info: https://bandit.readthedocs.io/en/1.8.6/plugins/b105_hardcoded_password_string.html
> > Location: src/parking/settings.py:19:13
> > 18 # SECURITY WARNING: keep the secret key used in production secret!
> > 19 SECRET_KEY = 'django-insecure-k)(flx8*!5_w*mzv77nrkumbzy08!i)v-u_93mcq#bkl%%p$6f'
> > 20

---

Code scanned:
Total lines of code: 732
Total lines skipped (#nosec): 0
Total potential issues skipped due to specifically being disabled (e.g., #nosec BXXX): 0

Run metrics:
Total issues (by severity):
Undefined: 0
Low: 1
Medium: 0
High: 0
Total issues (by confidence):
Undefined: 0
Low: 0
Medium: 1
High: 0
Files skipped (0):
