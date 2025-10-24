#!/bin/sh
commit_msg_file="$1"
pattern='^(feat|fix|docs|style|refactor|test|chore|ci|security|feat!)(\([a-z0-9_#-]+\))?: .+$'

commit_msg=$(cat "$commit_msg_file")

if echo "$commit_msg" | grep -Eq "$pattern"; then
    exit 0
else
    # Message does not match the format
    echo "======================================================================="
    echo "ERROR: Commit message '$commit_msg' does not match semantic format."
    echo ""
    echo "The required format is: <type>[optional scope]: <subject>"
    echo ""
    echo "Example:"
    echo "feat(user-auth): add Google sign-in support"
    echo "fix: correct typo in installation guide"
    echo ""
    echo "--- Available Commit Types ---"
    echo ""
    echo "feat!:    A breaking change in functionality."
    echo "feat:     A new feature for the user."
    echo "fix:      A bug fix for the user."
    echo "security: Security-related changes or fixes."
    echo "docs:     Changes to the documentation."
    echo "style:    Formatting, missing semi colons, etc; no production code change."
    echo "refactor: Refactoring production code, e.g., renaming a variable."
    echo "test:     Adding missing tests, refactoring tests; no production code change."
    echo "chore:    Updating build tasks, dependencies, etc; no production code change."
    echo "ci:       Changes to CI configuration files and scripts."
    echo "ci:       Updating CI configuration files and scripts."
    echo "security: Fixing security vulnerabilities."
    echo "feat!:   A breaking change for the user."
    echo ""
    echo "More details: https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716"
    echo "======================================================================="

    exit 1
fi