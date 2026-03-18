# 🧠 AI-Driven Development Workflow Guide

## Introduction: The Operator Mindset

This guide documents the systematic approach to AI-assisted software development based on the AI Coding Course methodology. It transforms you from a "pair programmer" to a **high-level operator** who architects solutions and validates outputs, while the AI serves as a powerful, high-speed implementation engine.

---

## 🎯 Core Principles

### 1. The AI is a Tool, Not a Teammate

**Wrong Mental Model**: "The AI is my junior dev teammate"
- Implies shared context and memory of past decisions
- Assumes understanding of "tribal knowledge"
- Leads to conversational, vague instructions
- Results in misaligned output
- Causes frustration when the AI "forgets" previous context

**Correct Mental Model**: "The AI is a high-variance, high-speed tool"
- A **stochastic engine** that requires precise calibration
- A **powerful but unpredictable** operator that needs rigid guardrails
- An **amnesiac savant** that resets with every new context window
- Demands verification at every step (verify, never trust)

**Operational Implications**:
- **Communication Style**: Shift from conversational to authoritative directive
  - Wrong: "What should we do about authentication?"
  - Right: "Implement JWT middleware in src/middleware/auth.ts following the pattern in src/middleware/cors.ts"
- **Validation Strategy**: Don't read for syntax errors (AI is good at that). Validate against your **Mental Model** of the architecture.
  - Ask: "Does this respect boundaries between layers?"
  - Ask: "Does error handling propagate correctly?"
  - If it doesn't fit your mental model → The plan or context was wrong → Regenerate

### 2. Verify, Never Trust (The Mental Model Principle)

The senior engineer's primary role is **architectural validation**, not syntax checking.

**Your Mental Model** is your internal simulation of the system:
- How data flows through the application
- Where state is mutated and why
- How errors propagate through middleware
- Where security boundaries exist
- Which components have which responsibilities

**Validation Process**:
1. **Don't read every line for syntax** - The AI is already better at syntax than you
2. **Do validate against your Mental Model** - Does this fit the architecture?
3. **Ask architectural questions**:
   - "Does this middleware intercept before or after validation?"
   - "Does this state update trigger unnecessary re-renders?"
   - "Is business logic leaking into the view layer?"
4. **If architecture is wrong** → The context was insufficient → Regenerate with better grounding

**Key Insight**: If the generated code contradicts your mental model, don't patch it manually. This is a signal that the AI misunderstood the system. Refine the context (AGENTS.md, better prompts) and regenerate.

### 3. Fail Fast, Regenerate Often (The Iteration Decision)

**The Highest-Leverage Decision**: The choice between "Iterate" and "Regenerate" in the Validate phase is the most critical decision in the entire workflow.

**Anti-Pattern**: Manually patching AI-generated code
- Symptom of "Sunk Cost Fallacy" - you've already invested tokens/time
- Often takes 2-3x longer than regenerating with better context
- Accumulates technical debt from fundamentally flawed generations
- Results in fragile code that barely works

**Best Practice**: Discard and regenerate
- **Recognize the signal**: Implementation reveals architectural misunderstanding
- **Stop immediately**: Don't try to "coax" the AI into fixing broken code
- **Improve the input**: Refine context (update AGENTS.md), improve the prompt, add examples
- **Restart clean**: Regenerate from scratch with better grounding
- **Result**: Architecturally sound code that fits your mental model

**When to Iterate** (refine existing code):
- ✅ Implementation is fundamentally sound
- ✅ Missing edge case handling
- ✅ Minor stylistic issues
- ✅ Performance could be improved

**When to Regenerate** (start over):
- ❌ Misunderstands the architecture
- ❌ Uses wrong patterns (ignores AGENTS.md)
- ❌ Violates constraints
- ❌ Flawed plan revealed during validation

**Expert Discipline**: Abandon sunk costs in favor of architectural correctness. This is what separates high-performance operators from frustrated users.

---

## 🔄 The Four-Phase Workflow

Every task should flow through these four phases. This is **non-linear** and **iterative** - you may loop back to earlier phases based on validation results.

```
┌─────────────┐
│  RESEARCH   │  Ground the AI in reality
│  (Grounding)│  Code + Domain knowledge
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    PLAN     │  Strategic decision
│  (Strategy) │  Exact vs Exploration
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   EXECUTE   │  Implementation
│ (Implement) │  Supervised vs Autonomous
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  VALIDATE   │  Quality assurance
│   (QA)      │  Iterate or Regenerate?
└──────┬──────┘
       │
       ▼
    ┌───┴───┐
    │ Done? │─No──┐
    └───┬───┘     │
        │         │
       Yes        │
        │         │
        ▼         │
     Deploy    Return to
                Research/
                  Plan
```

---

## Phase 1: RESEARCH (Grounding)

**Goal**: Bridge the gap between the AI's general training and your specific codebase/domain.

### Why Research First?

Without grounding, the AI will:
- Hallucinate APIs that don't exist
- Use deprecated patterns
- Misunderstand your architecture
- Generate code that "looks right" but is fundamentally incompatible

### Two Types of Research

#### 1. Code Research (ChunkHound)
**Purpose**: Understand existing patterns in your codebase

**Questions to Answer**:
- How is authentication handled?
- Where are database queries made?
- What error handling patterns exist?
- How is state managed?

**Example Prompt**:
```markdown
Use ChunkHound to search for "authentication middleware".
Show me how we currently handle JWT validation.
```

#### 2. Domain Research (ArguSeek)
**Purpose**: Fetch up-to-date external knowledge

**Questions to Answer**:
- What are the latest best practices?
- Are there recent API changes?
- What security vulnerabilities exist?
- What are common pitfalls?

**Example Prompt**:
```markdown
Use ArguSeek to find the latest Next.js 14 App Router
documentation on middleware patterns.
```

### When to Skip Research

- **Never skip entirely**, but you can minimize for:
  - Very simple changes (typo fixes, style updates)
  - Repeated patterns you've done before in the same session
  - Following an exact template you've verified

---

## Phase 2: PLAN (Strategic Decision)

**Goal**: Decide HOW to solve the problem before writing code.

### The Critical Choice: Exact vs Exploration

#### Exact Planning (Fast & Directive)

**When to Use**:
- You know the solution
- Requirements are crystal clear
- Time-sensitive
- Low risk

**Characteristics**:
- Highly directive prompts
- Specific file paths
- Exact integration points
- Minimal AI agency

**Example**:
```markdown
Add rate limiting to /api/* using Redis.
Pattern: src/middleware/auth.ts
Limits: 1000/hr authenticated, 100/hr anonymous
Return 429 with Retry-After header.
```

**Outcome**: Fast execution, low token cost

#### Exploration Planning (Thorough & Investigative)

**When to Use**:
- Solution is unclear
- Multiple approaches possible
- High risk / critical path
- Learning/discovery needed

**Characteristics**:
- Open-ended prompts
- AI proposes alternatives
- Includes tradeoff analysis
- Higher AI agency

**Example**:
```markdown
Investigate why rate limiter fails under load.
Check Redis connection pools and timeout settings.
Propose 3 solutions with tradeoffs.
```

**Outcome**: Slower, higher token cost, but discovers optimal solutions

### Forcing Plan Mode in Cursor

Cursor doesn't have a dedicated "Plan Mode" - you must enforce it:

```markdown
# PLANNING MODE - READ ONLY

You are FORBIDDEN from generating code.
Your goal: Produce a detailed step-by-step plan.

1. Research: List files to read
2. Architecture: Describe the pattern
3. Steps: Break down atomically
4. Verification: How to verify each step

Output: Markdown plan (NO code blocks)
```

This prevents premature code generation.

---

## Phase 3: EXECUTE (Implementation)

**Goal**: Translate the plan into working code.

### Two Execution Modes

#### Supervised Mode ("Babysitting")

**When to Use**:
- Critical path code
- High complexity
- Security-sensitive
- Learning/training

**How**:
1. Use Cursor Chat (turn-by-turn)
2. "Read file X"
3. Review AI's understanding
4. "Now plan the change"
5. Review plan
6. "Now implement"
7. Review implementation

**Pros**: Maximum control, learn as you go
**Cons**: Slower, more interactive

#### Autonomous Mode ("YOLO" / "Autopilot")

**When to Use**:
- Well-defined tasks
- Clear plan from Phase 2
- Low-risk components
- Repetitive patterns

**How**:
1. Use Cursor Composer (Ctrl+I / Cmd+I)
2. Provide comprehensive plan + context
3. "Apply to all files"
4. Let AI execute entire plan
5. Review output afterwards

**Pros**: Fast, can parallelize multiple agents
**Cons**: Higher risk of errors

### Hybrid Approach

Most tasks benefit from a hybrid:
1. **Supervised** for critical parts (auth logic, data models)
2. **Autonomous** for peripheral work (UI components, tests)

---

## Phase 4: VALIDATE (Quality Assurance)

**Goal**: Verify the output meets requirements and architectural standards.

### The Critical Decision: Iterate or Regenerate?

**CRITICAL INSIGHT**: This is the **highest-leverage** decision in the entire workflow. Mastering this decision separates 10x operators from struggling users.

#### Iterate (Refine Existing Code)

**When to Choose**:
- ✅ Implementation is fundamentally sound
- ✅ Missing edge case handling
- ✅ Minor stylistic issues
- ✅ Performance could be improved

**Action**: Give feedback, ask AI to refine

#### Regenerate (Start Over)

**When to Choose**:
- ❌ Misunderstands the architecture
- ❌ Uses wrong patterns
- ❌ Ignores constraints from AGENTS.md
- ❌ Flawed plan revealed

**Action**: Stop, discard code, improve context/plan, regenerate

### Validation Checklist

Before accepting code, verify:

1. **Correctness**: Does it solve the problem?
   - [ ] Meets functional requirements
   - [ ] Handles edge cases
   - [ ] Proper error handling

2. **Alignment**: Fits your mental model?
   - [ ] Respects architectural boundaries
   - [ ] Follows project patterns (AGENTS.md)
   - [ ] Integrates correctly

3. **Quality**: Production-ready?
   - [ ] Tests pass
   - [ ] No linter errors
   - [ ] Performance acceptable
   - [ ] Security reviewed

4. **Maintainability**: Can future devs understand it?
   - [ ] Clear variable names
   - [ ] Appropriate comments
   - [ ] Not overly complex

---

## 🔁 Workflow Non-Linearity

The workflow is **not strictly sequential**. Common loops:

### Loop 1: Validation → Research
**Trigger**: Validation reveals missing context
**Action**: Go back to Research phase, gather more info, regenerate

### Loop 2: Validation → Plan
**Trigger**: Implementation reveals the plan was flawed
**Action**: Go back to Plan phase, revise strategy, re-execute

### Loop 3: Plan → Research
**Trigger**: During planning, realize you need more info
**Action**: Do more research, then continue planning

---

## 🎓 Second-Order Insights

### Insight 1: The Iteration Decision is Leverage Itself

Novice users fall into the "coaxing trap" - trying to fix confused AI output with more prompts. This consumes time and tokens while degrading code quality. **Expert operators recognize that fundamental misalignment is a signal to stop, adjust context, and regenerate.**

The workflow is a cycle of continuous refinement where each iteration sharpens not just the code, but your mental model of the system.

### Insight 2: Delegate Log Analysis

AI agents excel at pattern recognition in large datasets. Don't manually grep through thousands of log lines. Instead:
1. Pipe raw logs into the agent's context (paste directly)
2. "Find the first divergence from the happy path"
3. The agent correlates timestamps, error codes, and stack traces
4. Turns "needle in a haystack" into trivial retrieval

**Example**: "Here are 2000 lines of server logs. Find where the auth token validation starts failing."

### Insight 3: Standardization of AI-to-System Interfaces

AGENTS.md and .cursorrules signal a broader trend: **the standardization of AI-to-System interfaces**. Just as libraries include TypeScript definitions (.d.ts) to guide compilers, we can anticipate a future where frameworks ship with `.ai.md` files - context files designed specifically to teach AI agents how to use them correctly.

By adopting these standards now, you're positioning yourself at the forefront of a fundamental architectural shift in software development.

---

## 🎓 Best Practices

### Do's

✅ **Always start with Research** - Even "quick fixes" benefit from verification
✅ **Plan before coding** - Use Planning Mode for complex tasks
✅ **Validate ruthlessly** - Don't accept "good enough"
✅ **Regenerate early** - Don't fix fundamentally broken code
✅ **Document decisions** - Update AGENTS.md with learnings
✅ **Use tools immediately** - Make AI use ChunkHound/ArguSeek proactively

### Don'ts

❌ **Don't skip phases** - Rushing leads to rework
❌ **Don't patch broken code** - Regenerate instead
❌ **Don't accept vague plans** - Demand specificity
❌ **Don't trust without verification** - Always validate
❌ **Don't ignore your mental model** - If it feels wrong, it probably is
❌ **Don't work in single large steps** - Break down into atomic operations

---

## 📊 Workflow Optimizations

### For Speed

1. **Use Exact Planning** when requirements are clear
2. **Enable Autonomous Mode** for low-risk tasks
3. **Batch similar tasks** - Generate multiple components at once
4. **Cache context** - Reuse Research phase results in same session

### For Quality

1. **Use Exploration Planning** for critical features
2. **Enable Supervised Mode** with turn-by-turn review
3. **Add extra validation steps** - More testing, peer review
4. **Document edge cases** - Explicit test requirements

### For Learning

1. **Use Supervised Mode** - Learn patterns as AI generates
2. **Ask AI to explain** - "Why did you choose this approach?"
3. **Try both modes** - Compare Exact vs Exploration results
4. **Review diffs carefully** - Understand every change

---

## 🔍 Real-World Examples

### Example 1: Bug Fix (Evidence-Based)

**Task**: "Auth is broken"

**Wrong Approach**:
```
→ Execute: "Fix the auth"
→ AI guesses at solutions
→ Iterate on broken fixes
→ Waste time
```

**Right Approach**:
```
→ Research: Read auth middleware, check logs
→ Plan: Use Evidence-Based Debugging protocol
→ Execute (Supervised): Add instrumentation, gather evidence
→ Validate: Verify root cause before fixing
→ Execute: Implement fix based on evidence
→ Validate: Test with reproduction case
```

### Example 2: New Feature (Complex)

**Task**: "Add user profile page"

**Wrong Approach**:
```
→ Execute: "Create user profile page"
→ AI generates generic profile
→ Doesn't match our architecture
→ Regenerate multiple times
```

**Right Approach**:
```
→ Research: Check AGENTS.md, find similar pages
→ Plan (Exploration): Ask AI to propose structure
→ Validate Plan: Review before execution
→ Execute (Autonomous): Use approved plan
→ Validate: Check alignment with architecture
```

### Example 3: Refactor (High Risk)

**Task**: "Refactor auth system"

**Wrong Approach**:
```
→ Execute (Autonomous): "Refactor auth"
→ AI makes sweeping changes
→ Everything breaks
→ Rollback and start over
```

**Right Approach**:
```
→ Research: Map all current dependencies
→ Plan (Exact): Break into incremental steps
→ Execute (Supervised): One step at a time
→ Validate: Test after each step
→ Loop: Next step only if current validated
```

---

## 🛠️ Cursor-Specific Tips

### Chat vs Composer

- **Chat**: Supervised mode, turn-by-turn
- **Composer**: Autonomous mode, bulk changes

### Using with .cursorrules

The `.cursorrules` file automatically injects into every Chat/Composer session. It should:
- Define Claudette persona
- Enforce Four-Phase Workflow
- Mandate Evidence-Based Debugging

### MCP Tools Integration

When ChunkHound and ArguSeek are configured:
- AI can proactively search code
- AI can fetch latest docs
- Reduces hallucination risk

---

## 📚 Related Resources

- **PROMPTS.md** - Ready-to-use prompt templates
- **.cursorrules** - AI agent configuration
- **AGENTS.md** - Project context file
- **CODE_REVIEW_CHECKLIST.md** - Review standards

---

## 🎯 Success Metrics

You're doing it right when:

✅ AI rarely generates code that needs major revisions  
✅ You regenerate code 2-3 times max before accepting  
✅ Plans are detailed and match final implementation  
✅ Bugs are diagnosed with evidence, not guesses  
✅ Code reviews happen before merge, not after problems  

---

**Remember**: The workflow is a discipline, not a script. Adapt it to your context, but don't skip phases. The rigor is what unlocks the productivity gains.

---

**Created**: November 21, 2024  
**Source**: AI Coding Course Methodology  
**Status**: Production Ready ✅

