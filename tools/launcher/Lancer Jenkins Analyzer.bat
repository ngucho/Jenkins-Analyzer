@echo off
rem Lance Jenkins Analyzer et ouvre le navigateur. Fonctionne aussi depuis un partage reseau (NAS).
title Jenkins Analyzer
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable sur ce poste.
  echo Installez Node.js 20.19 ou plus recent ^(https://nodejs.org^) puis relancez ce fichier.
  pause
  exit /b 1
)
pushd "%~dp0"
node serve.mjs --open
popd
pause
