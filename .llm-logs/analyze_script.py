import json
import re
from collections import Counter

with open(r'c:\Sistemas diversos\thegapfiles\hub\.llm-logs\2026-02-18T22-13-15_script-groq_ok.json', encoding='utf-8') as f:
    data = json.load(f)

# JSON structure: data['parsed']['scenes']
if isinstance(data, list):
    scenes = data
elif 'scenes' in data:
    scenes = data['scenes']
elif 'parsed' in data and 'scenes' in data['parsed']:
    scenes = data['parsed']['scenes']
else:
    scenes = next(v for v in data.values() if isinstance(v, list))

print(f"Total scenes: {len(scenes)}")
print()

# 1. Analyze motionDescriptions
motions = [s.get('motionDescription', '') or '' for s in scenes]

# Count movement types
def get_primary(motion):
    m = motion.lower()
    movements = [
        'static', 'dolly forward', 'dolly in', 'push-in',
        'pull-back', 'dolly backward', 'dolly out',
        'pan left', 'pan right', 'pan',
        'tilt up', 'tilt down', 'tilt',
        'lateral slide', 'rack focus', 'breathing camera',
        'deliberate freeze', 'freeze'
    ]
    for mv in movements:
        if mv in m:
            return mv
    return 'unknown'

movement_types = [get_primary(m) for m in motions]
movement_counts = Counter(movement_types)
print("=== MOVEMENT TYPE DISTRIBUTION ===")
for mv, count in movement_counts.most_common():
    pct = count/len(scenes)*100
    print(f"  {mv}: {count} ({pct:.1f}%)")
print()

# 2. Push-in percentage
push_in_count = sum(1 for m in motions if 'push-in' in m.lower() or 'dolly in' in m.lower() or 'dolly forward' in m.lower())
print(f"=== PUSH-IN PERCENTAGE ===")
print(f"  Push-in variants: {push_in_count}/{len(scenes)} = {push_in_count/len(scenes)*100:.1f}%")
print()

# 3. Static percentage
static_count = sum(1 for m in movement_types if m == 'static')
print(f"=== STATIC PERCENTAGE ===")
print(f"  Static: {static_count}/{len(scenes)} = {static_count/len(scenes)*100:.1f}%")
print()

# 4. Normalized motion uniqueness
def normalize(m):
    return re.sub(r'\d+(\.\d+)?', 'N', m.lower()).strip()

normalized = [normalize(m) for m in motions if len(m) > 20]
unique_normalized = set(normalized)
print(f"=== MOTION UNIQUENESS ===")
print(f"  Total scenes: {len(motions)}")
print(f"  Unique normalized motions: {len(unique_normalized)}")
print(f"  Uniqueness: {len(unique_normalized)/len(motions)*100:.1f}%")
print()

# 5. Template detection: "Static locked-off shot, a single X" pattern
template_static = [m for m in motions if 'static locked' in m.lower() and 'single' in m.lower()]
template_dolly = [m for m in motions if 'over the full 7.5 seconds, no pan or tilt' in m.lower()]
print(f"=== TEMPLATE DETECTION ===")
print(f"  'Static locked-off + single [X]' template: {len(template_static)} scenes")
for m in template_static:
    print(f"    - {m[:80]}")
print(f"  'over the full 7.5 seconds, no pan or tilt' template: {len(template_dolly)} scenes")
print()

# 6. Consecutive same movement violations
print("=== CONSECUTIVE MOVEMENT VIOLATIONS (>2) ===")
curr_consecutive = 1
violations = []
for i in range(1, len(movement_types)):
    if movement_types[i] == movement_types[i-1] and movement_types[i] not in ('', 'unknown'):
        curr_consecutive += 1
        if curr_consecutive > 2:
            violations.append(f"  Scenes {i-curr_consecutive+2}-{i+1}: '{movement_types[i]}' x{curr_consecutive}")
    else:
        curr_consecutive = 1
if violations:
    # deduplicate: only show when streak changes
    seen = set()
    for v in violations:
        if v not in seen:
            seen.add(v)
            print(v)
else:
    print("  Nenhuma violacao!")
print()

# 7. Forbidden words in motionDescription
forbidden = ['zoom', 'handheld', 'wobble', 'shake', 'tremor', 'truck', 'fast', 'quick', 'rapid', 'swift']
print("=== FORBIDDEN WORDS IN MOTION ===")
found_any = False
for word in forbidden:
    count = sum(1 for m in motions if word in m.lower())
    if count > 0:
        found_any = True
        print(f"  '{word}': {count} ocorrencias")
if not found_any:
    print("  Nenhuma palavra proibida encontrada.")
print()

# 8. Weak words in visualDescription
visuals = [s.get('visualDescription', '') or '' for s in scenes]
weak_words = ['moody', 'atmospheric', 'gritty', 'eerie', 'dramatic', 'concept art']
print("=== WEAK WORDS IN VISUAL ===")
found_any = False
for word in weak_words:
    count = sum(1 for v in visuals if word in v.lower())
    if count > 0:
        found_any = True
        print(f"  '{word}': {count} ocorrencias")
if not found_any:
    print("  Nenhuma palavra fraca encontrada.")
print()

# 9. Word count stats for visualDescription
word_counts = [len((v or '').split()) for v in visuals]
too_short = sum(1 for w in word_counts if w < 35)
too_long = sum(1 for w in word_counts if w > 70)
avg_words = sum(word_counts) / len(word_counts) if word_counts else 0
print(f"=== VISUAL DESCRIPTION WORD COUNT ===")
print(f"  Average: {avg_words:.1f} words")
print(f"  Too short (<35): {too_short}")
print(f"  Too long (>70): {too_long}")
print()

# 10. Narration: detect repeated blocks (check for duplicated narrations)
narrations = [s.get('narration', '') or '' for s in scenes]
narration_normalized = [normalize(n) for n in narrations]
dup_narrations = [n for n, count in Counter(narration_normalized).items() if count > 1]
print(f"=== NARRATION DUPLICATES ===")
print(f"  Exact duplicates: {len(dup_narrations)}")
print()

# 11. Check environment distribution
environments = [s.get('sceneEnvironment', 'unknown') or 'unknown' for s in scenes]
env_counts = Counter(environments)
print(f"=== SCENE ENVIRONMENT DISTRIBUTION ===")
for env, count in env_counts.most_common(15):
    print(f"  {env}: {count}")
print()

# 12. Sampling of motions to show diversity
print("=== SAMPLE MOTIONS (every 10th scene) ===")
for i in range(0, len(scenes), 10):
    s = scenes[i]
    print(f"  [{i}] {s.get('motionDescription', '')[:100]}")
