#!/bin/bash
set -e

# Get all ralphy branches
branches=$(git branch | grep "ralphy/" | sed 's/^[* ]*//')
total=$(echo "$branches" | wc -l)
count=0
failed=0

echo "Merging $total branches..."

for branch in $branches; do
    count=$((count + 1))
    echo "[$count/$total] Merging $branch..."
    
    # Try to merge with allowing unrelated histories and favoring theirs on conflict
    if git merge --no-edit -X theirs "$branch" 2>/dev/null; then
        echo "  OK"
    else
        echo "  CONFLICT - using theirs strategy"
        git checkout --theirs . 2>/dev/null || true
        git add -A 2>/dev/null || true
        git commit --no-edit -m "Merge $branch" 2>/dev/null || true
    fi
done

echo "Done! Merged $count branches"
