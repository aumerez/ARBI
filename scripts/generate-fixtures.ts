#!/usr/bin/env node

/**
 * Generate sample document fixtures for testing
 * Creates: sample.pdf, sample.docx, sample.txt
 */

import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures');

// Ensure fixtures directory exists
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

// ============================================================================
// SAMPLE CONTENT GENERATION
// ============================================================================

function generateLoremIpsum(wordCount: number): string {
  const baseWords = [
    'Lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
    'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
    'magna', 'aliqua', 'Enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud',
    'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo',
    'consequat', 'Duis', 'aute', 'irure', 'dolor', 'in', 'reprehenderit', 'in',
    'voluptate', 'velit', 'esse', 'cillum', 'dolore', 'eu', 'fugiat', 'nulla',
    'pariatur', 'Excepteur', 'sint', 'occaecat', 'cupidatat', 'non', 'proident',
    'sunt', 'culpa', 'qui', 'officia', 'deserunt', 'mollit', 'anim', 'id', 'est',
    'laborum'
  ];

  const sentences = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi aliquip.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
    'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
    'Ut enim ad minima veniam, quis nostrum exercitationem ullam.',
    'Corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.',
    'Quia ducimus sint, molestiae perspiciatis eos praesentium.',
  ];

  let words: string[] = [];
  while (words.length < wordCount) {
    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    const sentenceWords = sentence.split(/\s+/);
    words.push(...sentenceWords);
  }

  return words.slice(0, wordCount).join(' ');
}

function generateTechnicalContent(wordCount: number): string {
  const sections = [
    'Section 1: Introduction',
    'This document provides technical guidance for operations personnel.',
    'Procedures outlined in this document must be followed strictly.',
    '',
    'Section 2: Safety Protocols',
    'All operators must wear appropriate personal protective equipment (PPE) before entering the facility.',
    'Safety is the highest priority in all operational procedures.',
    'Failure to comply with safety protocols may result in disciplinary action.',
    '',
    'Section 3: Equipment Operation',
    'Before operating any equipment, ensure all safety guards are in place.',
    'Check fluid levels, pressure gauges, and emergency stops prior to startup.',
    'Follow startup sequence exactly as documented in the equipment manual.',
    '',
    'Section 4: Maintenance Procedures',
    'Regular maintenance is required to ensure optimal equipment performance.',
    'Daily checks include: visual inspection, lubrication points, and operational tests.',
    'Weekly maintenance covers filter changes, belt tension, and calibration checks.',
    '',
    'Section 5: Troubleshooting',
    'In case of equipment failure, consult the troubleshooting guide.',
    'Common issues include: low pressure, overheating, unusual noise, and vibration.',
    'Always isolate equipment before performing diagnostic checks.',
    '',
    'Section 6: Emergency Response',
    'In an emergency, activate the nearest emergency stop and evacuate the area.',
    'Notify supervisor and emergency response team immediately.',
    'Do not attempt to repair equipment during an active emergency situation.',
    '',
    'Section 7: Documentation',
    'All operational activities must be logged in the maintenance record.',
    'Incidents, near misses, and equipment failures must be documented.',
    'Reports should be submitted within 24 hours of the event.',
    '',
    'Section 8: Quality Control',
    'Quality control checks must be performed at each stage of the process.',
    'Record all measurements and compare against specification limits.',
    'Any deviations from specifications must be reported and investigated.',
    '',
    'ACKNOWLEDGEMENT',
    'This document is the property of the organization and contains confidential information.',
    'Distribution should be limited to authorized personnel only.',
    'Document revision history must be maintained and accessible.'
  ];

  const content = sections.join('\n');
  const words = content.split(/\s+/);
  if (words.length >= wordCount) {
    return words.slice(0, wordCount).join(' ');
  }

  // Pad with lorem ipsum if needed
  const padding = generateLoremIpsum(wordCount - words.length);
  return content + '\n\n' + padding;
}

// ============================================================================
// PDF GENERATION (with more content to exceed 10KB)
// ============================================================================

function generatePdf(): void {
  const filePath = path.join(FIXTURES_DIR, 'sample.pdf');
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  // Add title
  doc.fontSize(24).font('Helvetica-Bold').text('Technical Procedures Manual', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('Oil & Gas Operations', { align: 'center' });
  doc.fontSize(10).font('Helvetica-Oblique').text('Internal Use Only', { align: 'center' });
  doc.moveDown(2);

  // Add content - use 1500 words to ensure >10KB
  const content = generateTechnicalContent(1500);
  doc.fontSize(11).font('Helvetica').text(content, { align: 'justify', lineGap: 4 });

  // Add footer
  doc.fontSize(8).font('Helvetica').text('Page 1 of 1', { align: 'center' });

  doc.end();

  stream.on('finish', () => {
    const stats = fs.statSync(filePath);
    console.log(`✓ Generated PDF: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
  });
}

// ============================================================================
// DOCX GENERATION
// ============================================================================

function generateDocx(): void {
  const filePath = path.join(FIXTURES_DIR, 'sample.docx');
  const content = generateTechnicalContent(800);

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'Standard Operating Procedures',
          heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
          text: 'Operations Manual',
          heading: HeadingLevel.HEADING_2,
        }),
        ...content.split('\n').map(line => {
          if (line.startsWith('Section')) {
            return new Paragraph({
              text: line,
              heading: HeadingLevel.HEADING_2,
            });
          } else if (line.trim() === '') {
            return new Paragraph({ text: '' });
          } else {
            return new Paragraph({
              text: line,
              spacing: { after: 120 },
            });
          }
        }),
      ],
    }],
  });

  Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(filePath, buffer);
    const stats = fs.statSync(filePath);
    console.log(`✓ Generated DOCX: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
  }).catch(err => {
    console.error('Error generating DOCX:', err);
  });
}

// ============================================================================
// TXT GENERATION
// ============================================================================

function generateTxt(): void {
  const filePath = path.join(FIXTURES_DIR, 'sample.txt');

  const content = generateTechnicalContent(1500);
  const buffer = Buffer.from(content, 'utf-8');

  fs.writeFileSync(filePath, buffer);
  const stats = fs.statSync(filePath);
  console.log(`✓ Generated TXT: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);

  // Verify Section 1 and Section 2 exist
  if (!content.includes('Section 1') || !content.includes('Section 2')) {
    console.warn('⚠ Warning: TXT file missing expected section markers');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('Generating sample document fixtures...\n');

generatePdf();
generateDocx();
generateTxt();

setTimeout(() => {
  console.log('\n✓ All fixtures generated successfully.');
}, 1000);
