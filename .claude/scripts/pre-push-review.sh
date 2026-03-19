#!/bin/bash
set -euo pipefail
CMD=$(jq -r '.tool_input.command // ""' 2>/dev/null)
if ! echo "$CMD" | grep -qE "git push"; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
  exit 0
fi
cd /home/user/line-linear-bot
ISSUES=()
if ! bun run check >/dev/null 2>&1; then
  ISSUES+=("[Biome] lint/format error. Run bun run check:fix")
fi
V=$(grep -rn "@/usecase/" src/infrastructure/ 2>/dev/null || true)
[ -n "$V" ] && ISSUES+=("[Arch] infrastructure imports usecase (forbidden)")
V=$(grep -rn "@/presentation/" src/infrastructure/ 2>/dev/null || true)
[ -n "$V" ] && ISSUES+=("[Arch] infrastructure imports presentation (forbidden)")
V=$(grep -rn "@/presentation/" src/usecase/ 2>/dev/null || true)
[ -n "$V" ] && ISSUES+=("[Arch] usecase imports presentation (forbidden)")
V=$(grep -rn "from ['\"]\.\./" src/ 2>/dev/null || true)
[ -n "$V" ] && ISSUES+=("[Arch] relative path imports - use @/ aliases")
V=$(grep -rn "@linear/sdk\|LinearClient" src/ 2>/dev/null | grep -v "src/infrastructure/" || true)
[ -n "$V" ] && ISSUES+=("[Sec] Linear SDK outside infrastructure layer")
V=$(grep -rn "@google/generative-ai\|GoogleGenerativeAI" src/ 2>/dev/null | grep -v "src/infrastructure/" || true)
[ -n "$V" ] && ISSUES+=("[Sec] Gemini SDK outside infrastructure layer")
if [ ${#ISSUES[@]} -eq 0 ]; then
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
else
  REASON="Push blocked. Fix these issues and retry:"
  for issue in "${ISSUES[@]}"; do REASON="$REASON
- $issue"; done
  jq -n --arg r "$REASON" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$r}}'
fi
