#!/usr/bin/env bash
# Idempotent Cloud Agent setup for this repository.
#
# This repo is a collection of Agent Skills (Markdown), so there are no project
# dependencies to compile or lock. The development and distribution tool is the
# `skills` CLI (https://agentskills.io), which the README drives via `npx
# skills`. Installing it up front makes `skills` directly available on PATH
# without a per-invocation download, and lets an agent validate/install skills
# from a working copy (`skills add <path>`) or from GitHub (`skills add
# jssblck/agents`).
#
# The `skills` CLI requires Node >= 22.20.0. The default `npm` on PATH resolves
# to the nvm-managed Node that satisfies this, so the global install runs
# without an engine warning.
set -euo pipefail

echo "== toolchain =="
echo "node:  $(node --version)  ($(command -v node))"
echo "npm:   $(npm --version)  ($(command -v npm))"
echo "git:   $(git --version)"

echo "== installing skills CLI =="
npm install -g skills@latest

echo "skills: $(skills --version)  ($(command -v skills))"
