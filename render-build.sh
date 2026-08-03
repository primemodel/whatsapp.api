#!/usr/bin/env bash
# Atualiza os pacotes e instala o Chromium do sistema Linux nativamente
apt-get update && apt-get install -y wget gnupg
apt-get install -y chromium

# Roda o npm install normal
npm install
