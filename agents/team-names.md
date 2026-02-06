# Agent Team Names

## Overview

Agent Teams mode assigns **mythic Irish names** to agents instead of functional IDs like "issue-50". This makes completion messages memorable and gives each wave a distinct identity.

**This is cosmetic.** Agent behavior is defined entirely by prompts, not names. The `CLAUDE_CODE_AGENT_TYPE` env var still carries the functional role (e.g., "issue-lifecycle"). The name is just `CLAUDE_CODE_AGENT_NAME`.

> Your team name is cosmetic. Your behavior is defined entirely by your agent prompt.

---

## Team Names (CLAUDE_CODE_TEAM_NAME)

Teams are named after mythic Irish bands. The wave orchestrator picks one per wave:

| Team Name | Origin | Character | Best For |
|-----------|--------|-----------|----------|
| **Fianna** | Finn McCool's warband | Loyal, strategic, mobile | General-purpose waves |
| **Tuatha** | Tuatha De Danann (the gods) | Masterful, multi-skilled, luminous | Foundation / architecture waves |
| **Red Branch** | Ulster's warrior order | Fierce, disciplined, elite | Bug fix / combat waves |
| **Brigid's Forge** | Goddess of craft | Warm, precise, principled | Feature building waves |
| **Tir na nOg** | The Otherworld | Timeless, transformative, bold | Migration / refactor waves |

---

## Singleton Role Names

These agents run once per team. Their names are fixed:

| Role | Name | From | Why |
|------|------|------|-----|
| **waves-controller** | **Finn McCool** | Fenian Cycle | "Warrior-leader with salmon of knowledge; calm, strategic, protective" |
| **db-coordinator** | **Hamilton** | William Rowan Hamilton | "Abstract reasoning, pattern-finding, notation" — schema and numbers |
| **quality-gate** | **Keane** | Roy Keane | "Ruthless standards, fearless honesty" — nothing gets past the gate |
| **journey-gate** | **Scathach** | Warrior-trainer myth | "Legendary instructor; demanding, precise, formidable" — gating heroes |

---

## Issue-Lifecycle Name Pools

Issue-lifecycle agents (one per issue) draw names from themed pools. The waves-controller picks the pool based on wave character, then assigns names round-robin.

### Pool: Writers (contract-heavy waves)

| Name | Powers | Style |
|------|--------|-------|
| **Yeats** | Poetry, symbolism, cultural synthesis | Visionary, mystical |
| **Swift** | Satire, rhetoric, moral pressure | Razor-sharp, deterministic |
| **Beckett** | Minimalism, truth-telling | Spare, exacting |
| **Heaney** | Imagery, translation, voice | Grounded, precise |
| **Wilde** | Dialogue, satire, social critique | Witty, principled |
| **Joyce** | Experimental prose, observation, craft | Rebellious, obsessive |
| **Synge** | Field research, dialogue, realism | Sharp, lyrical |
| **Lady Gregory** | Organizing, patronage, editing | Practical, strategic |

### Pool: Builders (implementation-heavy waves)

| Name | Powers | Style |
|------|--------|-------|
| **Goibniu** | Forging, quality control, endurance | Focused, exacting, reliable |
| **Lugh** | Multi-skill mastery, invention | Bright, ambitious, just |
| **Brigid** | Healing, inspiration, smithcraft | Warm, luminous, principled |
| **Boyle** | Experiment design, analysis, rigor | Curious, methodical |
| **Tyndall** | Teaching, experimentation | Bold, clear, evidence-led |
| **Bell Burnell** | Signal detection, research discipline | Modest, persistent, exact |
| **Beaufort** | Measurement systems, documentation | Precise, system-minded |
| **Ogma** | Strength, writing, rhetoric | Bold, inventive |

### Pool: Warriors (bug fix / enforcement waves)

| Name | Powers | Style |
|------|--------|-------|
| **Cuchulainn** | Single combat, endurance | Proud, loyal, unstoppable |
| **Pearse** | Oratory, education, symbolism | Idealistic, theatrical, intense |
| **Collins** | Intelligence, logistics, leadership | Decisive, pragmatic, daring |
| **Markievicz** | Organizing, propaganda, leadership | Fearless, disciplined |
| **Connolly** | Union organizing, theory, agitation | Principled, uncompromising |
| **Macha** | Speed, curses, domination | Fierce, uncompromising |
| **Medb** | Command, manipulation, logistics | Ambitious, cunning, fearless |
| **Conall Cernach** | Dueling, resilience, intimidation | Disciplined, direct, loyal |

### Pool: Explorers (migration / infrastructure waves)

| Name | Powers | Style |
|------|--------|-------|
| **Crean** | Endurance, teamwork, navigation | Humble, indestructible |
| **Shackleton** | Leadership under pressure, morale | Optimistic, strategic |
| **Grace OMalley** | Navigation, bargaining, command | Bold, shrewd, unstoppable |
| **Manannan** | Navigation, illusion, protection | Enigmatic, generous |
| **Niamh** | Otherworld travel, charm, resolve | Romantic, determined |
| **Boann** | Flow-control, cleansing, renewal | Curious, bold, transformative |
| **Oisin** | Storytelling, archery, diplomacy | Reflective, loyal |
| **Bran the Blessed** | Sacrifice, protection, endurance | Generous, tragic, steadfast |

---

## Name Assignment (Phase 2)

The waves-controller assigns names during team spawn:

```
# 1. Pick team name based on wave character
team_name = "Fianna"  # or Tuatha, Red Branch, etc.

# 2. Pick issue-lifecycle pool based on wave type
pool = Writers  # if contract/spec heavy
pool = Builders # if implementation heavy
pool = Warriors # if bug fix heavy
pool = Explorers # if migration/infrastructure

# 3. Assign names round-robin from pool
issue #50 → Yeats
issue #51 → Swift
issue #52 → Beckett

# 4. Singleton roles always use fixed names
db-coordinator → Hamilton
quality-gate → Keane
journey-gate → Scathach
```

### spawnTeam Example

```
TeammateTool(operation: "spawnTeam", name: "Fianna", config: {
  agents: [
    { name: "Yeats",    prompt: "<issue-lifecycle prompt>\n\nISSUE_NUMBER=50" },
    { name: "Swift",    prompt: "<issue-lifecycle prompt>\n\nISSUE_NUMBER=51" },
    { name: "Beckett",  prompt: "<issue-lifecycle prompt>\n\nISSUE_NUMBER=52" },
    { name: "Hamilton", prompt: "<db-coordinator prompt>" },
    { name: "Keane",    prompt: "<quality-gate prompt>" }
  ]
})
```

---

## Completion Messages (Phase 8)

After a wave completes, the waves-controller generates a **named completion report** that references each agent's mythic powers alongside what they actually did.

### Template

```
═══════════════════════════════════════════════════════════════
WAVE <N> COMPLETE — Team <team_name>
═══════════════════════════════════════════════════════════════

<Name> (#<issue>) — <what they did>, with <mythic power flavor>
<Name> (#<issue>) — <what they did>, with <mythic power flavor>
<Name> (#<issue>) — <what they did>, with <mythic power flavor>

<Singleton> held <what they managed>.
<Singleton> let nothing past the gate.
Finn McCool orchestrated from above.

<N> issues closed. <N> regressions. All tiers <status>.
═══════════════════════════════════════════════════════════════
```

### Example

```
═══════════════════════════════════════════════════════════════
WAVE 3 COMPLETE — Team Fianna
═══════════════════════════════════════════════════════════════

Yeats (#325)  — crafted WhatsApp notification contracts with symbolic precision
Swift (#326)  — enforced no-show alert rules with razor rhetoric
Pearse (#327) — built the coverage request system with theatrical intensity

Hamilton held the schema steady across 3 migrations.
Keane let nothing past the gate — 47 tests, 0 failures.
Finn McCool orchestrated the wave from above.

3 issues closed. 0 regressions. All tiers green.
═══════════════════════════════════════════════════════════════
```

### Flavor Mapping

Match the agent's mythic powers to what they actually accomplished:

| Name | Mythic Flavor | Maps To |
|------|---------------|---------|
| Yeats | "symbolic precision" | Contract/spec writing |
| Swift | "razor rhetoric" | Rule enforcement, validation |
| Beckett | "spare clarity" | Minimal, clean implementation |
| Heaney | "grounded imagery" | UI components, visual work |
| Pearse | "theatrical intensity" | Feature building, ambitious scope |
| Collins | "shadow-operator precision" | Bug hunting, intelligence |
| Goibniu | "divine smithcraft" | Database/backend building |
| Lugh | "multi-skill mastery" | Full-stack implementation |
| Cuchulainn | "battle-frenzy focus" | Intensive bug fixing |
| Markievicz | "fearless discipline" | Security, access control |
| Hamilton | "held the schema steady" | DB coordination (always this) |
| Keane | "let nothing past the gate" | Quality gate (always this) |
| Scathach | "demanded excellence" | Journey gate (always this) |
| Crean | "endured the migration" | Infrastructure changes |
| Grace OMalley | "navigated uncharted schema" | New table/migration design |

---

## Guard Rails

1. **Names are cosmetic only.** The `CLAUDE_CODE_AGENT_TYPE` env var carries the functional role.
2. **Prompts define behavior.** An agent named "Yeats" follows the issue-lifecycle prompt, not poetic instincts.
3. **Each agent prompt should include:** *"Your team name is cosmetic. Your behavior is defined entirely by this prompt."*
4. **Don't roleplay.** The names appear in completion messages and team spawn configs. Agents do not adopt the personality of their namesake during work.
5. **Subagent mode ignores names.** When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is not set, functional names like "issue-50" are used instead.

---

## Full Name Pool Reference

See `agentnames.md` for the complete roster of 100 Irish mythic, literary, revolutionary, scientific, sporting, and cultural figures with powers and character descriptions.

See `agentlist.md` for the quick-reference name list.
