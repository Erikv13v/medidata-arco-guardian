# MediData ARCO+ Guardian

Secure web system for managing ARCO+ PAL data protection requests, emergency alerts and AI-assisted incident reporting in the healthcare context.

## Overview

MediData ARCO+ Guardian is a cybersecurity and data protection project designed to support the secure management of personal data rights requests and emergency incident reports.

The system includes a public portal for users/patients, secure email PIN verification, emergency alert reporting, AI-assisted incident summarization, automated email notifications and an internal API for administrators and collaborators.

> This project was developed as an academic and professional cybersecurity portfolio project.  
> No real patient data, production credentials or private environment files are included.

## Main Features

- Public ARCO+ PAL request portal
- Patient identity verification with email PIN
- Random temporary PIN generation
- Emergency alert reporting
- AI-assisted emergency incident summary
- Automated HTML email notifications
- Internal admin and collaborator roles
- PostgreSQL database integration
- Node.js and Express backend
- React frontend
- Linux server deployment
- Security-focused backend structure

## Technologies Used

### Frontend

- React
- JavaScript
- HTML
- CSS
- Vite

### Backend

- Node.js
- Express.js
- PostgreSQL
- Nodemailer
- OpenAI API
- Argon2
- Helmet
- CORS
- Rate limiting

### Systems & Security

- Ubuntu Server
- Linux systemd service
- UFW firewall
- SSH access
- Environment variables
- Secure email PIN flow
- Role-based internal access
- Security event logging

## Project Architecture

```text
User / Patient
     ↓
React Public Portal
     ↓
Node.js / Express API
     ↓
PostgreSQL Database
     ↓
Email Notifications / AI Assistance
     ↓
Internal Admin Review

```

## Key Modules

### Public Portal

Allows users to register, request a secure PIN, verify access and submit ARCO+ PAL requests.

### Email PIN Verification

Generates a temporary random PIN and sends it to the user’s registered email address.

### Emergency Alert System

Allows users to report urgent incidents such as threats, extortion or possible misuse of personal data.

### AI-Assisted Incident Summary

Uses AI to transform disorganized emergency reports into a structured summary for internal review.

### Internal API

Provides protected endpoints for administrators and collaborators to review requests, emergencies and audit information.

## Security Considerations

This project follows basic security principles such as:

- Password hashing
- Environment-based secrets
- Email PIN verification
- Token-based internal sessions
- Role separation
- Firewall configuration
- API rate limiting
- Sensitive data minimization
- No public exposure of `.env` files

## Important Notice

This repository does not include:

- API keys
- SMTP credentials
- Database passwords
- Real patient information
- Real identification numbers
- Production `.env` files
- Private server backups

## Current Status

Project under active development.

Completed:

- Backend API
- PostgreSQL database
- Public request flow
- Email PIN verification
- Emergency alert system
- AI summary generation
- HTML email notifications
- Internal API endpoints

Pending improvements:

- Full internal admin dashboard
- Production deployment with HTTPS
- Advanced security testing
- Automated backups
- Complete technical documentation

## Author

**Erik Vera Pincay**  
Computer Science Engineer  
Cybersecurity Master's Student  

- LinkedIn: https://linkedin.com/in/erik-v-97605b300
- GitHub: https://github.com/Erikv13v
