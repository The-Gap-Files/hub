# Baseline: marca todas as migrations EXCETO a última como já aplicadas (sem rodar SQL).
# Depois aplica só a migration nova (storyOutlineApproved). Nao apaga dados.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$existing = @(
  "20260201001335_init",
  "20260201021928_add_style_and_ratio",
  "20260201023630_add_motion_support",
  "20260203002030_add_visual_styles",
  "20260203013805_add_content_guidelines",
  "20260203015023_add_script_styles",
  "20260203021007_add_visual_style_categories",
  "20260203025435_add_seed_management",
  "20260203031829_migrate_to_bytea_compressed",
  "20260203044740_add_audio_description_to_scenes",
  "20260203045519_add_summary_to_scripts",
  "20260203053623_add_target_wpm_to_video",
  "20260204030056_add_narration_language_and_source_document",
  "20260205000000_add_document_first_architecture",
  "20260208000000_add_story_outline",
  "20260208010000_bgm_tracks_scene_based"
)

Write-Host "Marcando migrations existentes como aplicadas (baseline)..." -ForegroundColor Cyan
foreach ($m in $existing) {
  npx prisma migrate resolve --applied $m
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Aplicando apenas a migration nova (storyOutlineApproved)..." -ForegroundColor Green
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Concluido. Nenhum dado foi apagado." -ForegroundColor Green
