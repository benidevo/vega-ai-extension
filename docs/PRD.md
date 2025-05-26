# Ascentio Browser Extension: PRD

## Product Definition

A browser extension that extracts job listing data while browsing, allows users to review/edit the data, and uploads it to the Ascentio backend service.

## Core Features

1. **Job Data Extraction**
   - Auto-detect and extract job details from LinkedIn job listings
   - Fields: title, company, location, description, URL, job type, experience level, skills, requirements
   - Parse both structured data (JSON-LD) and HTML DOM elements

2. **Data Review & Editing**
   - Show extracted job data in editable form
   - Allow corrections or additions to any missing fields
   - Validate before submission

3. **Backend Integration**
   - Upload jobs to Ascentio backend
   - Store data during network interruptions
   - Provide upload status feedback

4. **Authentication**
   - Google Sign-In integration
   - Secure token storage and management

## User Flow

1. User visits LinkedIn job listing page
2. Extension automatically extracts job data
3. Extension icon shows notification badge
4. User clicks extension icon to open popup
5. Popup displays extracted job data in editable form
6. User reviews, optionally edits data
7. User clicks "Upload" button
8. System shows confirmation of successful upload

## Success Criteria

- Extract job data with 95% accuracy across supported sites
- Complete extraction within 3 seconds of page load
- Extension size under 1MB
