/**
 * Centralized Application Branding Configuration
 * Voter Management System (VMS)
 */

export const APP_CONFIG = {
  name: import.meta.env.VITE_APP_NAME || 'VMS',
  fullName: import.meta.env.VITE_APP_FULL_NAME || 'Voter Management System',
  shortName: import.meta.env.VITE_APP_SHORT_NAME || 'VMS',
  tagline: import.meta.env.VITE_APP_TAGLINE || 'Smart Voter Data Extraction & Management System',
  teluguName: 'వి.ఎమ్.ఎస్ (ఓటర్ మేనేజ్‌మెంట్ సిస్టమ్)',
  teluguTagline: 'తెలుగు ఓటర్ డేటా ఎక్స్‌ట్రాక్షన్ & మేనేజ్‌మెంట్ సిస్టమ్',
  version: '1.0.0',
  footerText: 'VMS · Voter Management System · Enterprise React & PostgreSQL Suite',
  logoText: 'VMS',
};

export default APP_CONFIG;
