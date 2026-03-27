#!/bin/bash
# Runs on every container start (postStartCommand).
# Prints helpful reminders — no auto-start of servers (let developer control that).

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Find My Expert — Dev Environment             ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Start CAP backend:                                  ║"
echo "║    npm run watch                                     ║"
echo "║    → http://localhost:4004                           ║"
echo "║                                                      ║"
echo "║  Start UI5 frontend (in a new terminal):             ║"
echo "║    cd app/findmyexpert && npm run start:sandbox      ║"
echo "║    → http://localhost:8080/sandbox.html              ║"
echo "║                                                      ║"
echo "║  UI5 proxy target: http://localhost:4004             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
