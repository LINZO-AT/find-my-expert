# Joule Skill: Find My Expert

## Overview
This Joule Skill enables natural language expert search via SAP Joule Copilot.

## Prerequisites
1. SAP BTP Subaccount with Joule entitlement (Joule Studio)
2. Find My Expert CAP service deployed to Cloud Foundry
3. BTP Destination `FINDMYEXPERT_BACKEND` pointing to the deployed service

## Setup

### 1. Create BTP Destination
In BTP Subaccount → Connectivity → Destinations:
- **Name:** `FINDMYEXPERT_BACKEND`
- **Type:** HTTP
- **URL:** `https://<app-url>.cfapps.<region>.hana.ondemand.com`
- **Authentication:** OAuth2UserTokenExchange

### 2. Deploy Skill in Joule Studio
1. Open Joule Studio → Skill Builder → Create New Skill
2. Import `skill-definition.json`
3. Configure destination binding
4. Test in Joule Playground → Publish

## Example Queries
- "Who is my expert for Signavio?"
- "Wer ist mein Experte für S/4HANA Finance?"
- "Find an expert for SAP BTP Integration Suite"
