/**
 * Data Volume Reality Check
 * Run this to assess data availability before committing to Phase 2/3
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' });

async function runDataAudit() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔍 Running Data Availability Assessment...\n');

    // Get record counts by domain
    const result = await pool.query(`
      SELECT 
        domain,
        COUNT(*) as record_count,
        COUNT(DISTINCT project_id) as project_count,
        MIN(created_at) as oldest,
        MAX(created_at) as newest,
        EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))/86400 as days_span,
        AVG((ai_confidence IS NOT NULL)::int * 100) as avg_ai_confidence
      FROM asbuilt_records
      GROUP BY domain
      ORDER BY record_count DESC
    `);

    console.log('='.repeat(80));
    console.log('DATA AVAILABILITY BY DOMAIN');
    console.log('='.repeat(80));
    console.log();

    // Minimum viable thresholds
    const THRESHOLDS = {
      'phase_2': 1000,
      'phase_3_nlp': 5000,
      'phase_3_cv': 500
    };

    let totalRecords = 0;
    const domainStatus = [];

    for (let row of result.rows) {
      const { domain, record_count, project_count, oldest, newest, days_span, avg_ai_confidence } = row;
      totalRecords += parseInt(record_count);

      // Assess readiness
      const readyForPhase2 = record_count >= THRESHOLDS.phase_2;
      const readyForPhase3NLP = record_count >= THRESHOLDS.phase_3_nlp;
      
      const status = {
        domain,
        record_count,
        project_count,
        days_span: Math.round(days_span),
        avg_ai_confidence: Math.round(avg_ai_confidence),
        readyForPhase2,
        readyForPhase3NLP,
        needsMoreData: !readyForPhase2,
        gap: readyForPhase2 ? 0 : THRESHOLDS.phase_2 - record_count
      };

      domainStatus.push(status);

      // Print domain details
      console.log(`📊 ${domain}`);
      console.log(`   Records: ${record_count} ${readyForPhase2 ? '✅' : '⚠️'}`);
      console.log(`   Projects: ${project_count}`);
      console.log(`   Time Span: ${Math.round(days_span)} days`);
      console.log(`   Avg AI Confidence: ${Math.round(avg_ai_confidence)}%`);
      console.log(`   Ready for Phase 2: ${readyForPhase2 ? '✅' : '❌'} (needs ${THRESHOLDS.phase_2})`);
      console.log(`   Ready for Phase 3 NLP: ${readyForPhase3NLP ? '✅' : '❌'} (needs ${THRESHOLDS.phase_3_nlp})`);
      console.log();
    }

    console.log('='.repeat(80));
    console.log('OVERALL ASSESSMENT');
    console.log('='.repeat(80));
    console.log();

    const readyForPhase2Domains = domainStatus.filter(d => d.readyForPhase2);
    const readyForPhase3Domains = domainStatus.filter(d => d.readyForPhase3NLP);

    console.log(`Total Records: ${totalRecords}`);
    console.log(`Domains Ready for Phase 2: ${readyForPhase2Domains.length}/${domainStatus.length}`);
    console.log(`Domains Ready for Phase 3 NLP: ${readyForPhase3Domains.length}/${domainStatus.length}`);
    console.log();

    // Recommendations
    console.log('📋 RECOMMENDATIONS:');
    console.log();

    if (readyForPhase2Domains.length === 0) {
      console.log('❌ NOT READY FOR PHASE 2');
      console.log('   → Focus on Phase 1b (data collection)');
      console.log('   → Minimum required: 1,000 records per domain');
      console.log('   → Estimate: 2-4 weeks of active usage');
    } else if (readyForPhase2Domains.length === domainStatus.length) {
      console.log('✅ READY FOR PHASE 2');
      console.log('   → Can proceed with lightweight ML models');
      console.log('   → Start with: Anomaly Detection (Week 5-6)');
    } else {
      console.log('⚠️ PARTIALLY READY FOR PHASE 2');
      console.log('   → Can build models for: ' + readyForPhase2Domains.map(d => d.domain).join(', '));
      console.log('   → Need more data for: ' + domainStatus.filter(d => !d.readyForPhase2).map(d => d.domain).join(', '));
    }

    if (readyForPhase3Domains.length >= 3) {
      console.log('✅ READY FOR PHASE 3 NLP');
      console.log('   → Can fine-tune BERT for domain classification');
    } else {
      console.log('❌ NOT READY FOR PHASE 3 NLP');
      console.log('   → Need 5,000+ labeled examples');
      console.log('   → Estimate: 4-8 weeks of active usage');
    }

    console.log();
    console.log('📸 COMPUTER VISION CHECK:');
    const imageCount = await pool.query(`
      SELECT COUNT(*) FROM file_metadata 
      WHERE file_type IN ('image/jpeg', 'image/png', 'image/jpg')
    `);

    if (imageCount.rows[0].count < THRESHOLDS.phase_3_cv) {
      console.log('❌ Not enough images for CV model');
      console.log(`   → Currently have: ${imageCount.rows[0].count}`);
      console.log(`   → Need: ${THRESHOLDS.phase_3_cv}+ annotated images`);
      console.log('   → Recommendation: DEFER Phase 3c (CV Defect Detection)');
    } else {
      console.log('⚠️ Have images, but need annotations');
      console.log('   → Recommendation: DEFER until annotation workflow established');
    }

    console.log();
    console.log('='.repeat(80));
    console.log('\n✅ Data audit complete!\n');

  } catch (error) {
    console.error('❌ Error running data audit:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run audit
runDataAudit();

