# Commit Command

Generate conventional commit messages based on staged changes.

## Usage
Run `/commit` after staging changes with `git add`.

## Instructions

1. **Analyze staged changes**
   ```bash
   git diff --cached --stat
   git diff --cached
   ```

2. **Determine commit type**
   - `feat`: New feature
   - `fix`: Bug fix
   - `refactor`: Code change that neither fixes nor adds
   - `docs`: Documentation only
   - `style`: Formatting, missing semicolons, etc.
   - `test`: Adding or updating tests
   - `chore`: Maintenance tasks

3. **Identify scope** (optional)
   - Component name, feature area, or module affected
   - Examples: `auth`, `storefront`, `migrations`, `cart`

4. **Write commit message**
   Format: `type(scope): description`
   
   Rules:
   - Description under 50 characters
   - Use imperative mood ("add" not "added")
   - No period at the end
   - Lowercase

5. **If complex changes**, add body:
   ```
   type(scope): short description
   
   - Bullet point explaining what changed
   - Another point if needed
   ```

## Examples

```bash
# Simple feature
git commit -m "feat(cart): add quantity selector to cart items"

# Bug fix
git commit -m "fix(checkout): prevent double order submission"

# Refactor
git commit -m "refactor(hooks): extract useStoreData from StorefrontPage"

# Multiple changes
git commit -m "feat(storefront): add coupon system

- Add StorefrontCoupons.tsx admin page
- Create storefront_coupons table migration
- Add apply_coupon RPC with validation"
```

## Output

Present the suggested commit command ready to run:
```bash
git commit -m "type(scope): description"
```
