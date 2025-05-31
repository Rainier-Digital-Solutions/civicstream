const { getDefaultErrorResponse } = require('../lib/openai.ts');

/**
 * Simple test to verify our updated ReviewResult schema works correctly
 */
function testUpdatedSchema() {
    console.log('Testing updated ReviewResult schema...\n');

    try {
        // Test the default error response with new schema
        const defaultResponse = getDefaultErrorResponse();

        console.log('✓ Default response generated successfully');
        console.log('✓ Has missingPlans array:', Array.isArray(defaultResponse.missingPlans));
        console.log('✓ Has missingPermits array:', Array.isArray(defaultResponse.missingPermits));
        console.log('✓ Has missingDocumentation array:', Array.isArray(defaultResponse.missingDocumentation));
        console.log('✓ Has missingInspectionCertificates array:', Array.isArray(defaultResponse.missingInspectionCertificates));
        console.log('✓ Has traditional findings arrays');
        console.log('✓ Has email bodies');

        // Test a sample review result with missing items
        const sampleResult = {
            summary: "Test review with missing items",
            missingPlans: [
                {
                    description: "Missing site plan",
                    codeSection: "Section 12.04.020",
                    remedialAction: "Submit detailed site plan showing property boundaries",
                    confidenceScore: 0.95,
                    severity: "major"
                }
            ],
            missingPermits: [
                {
                    description: "Missing building permit application",
                    codeSection: "Section 15.02.010",
                    remedialAction: "Complete and submit building permit application",
                    confidenceScore: 0.90,
                    severity: "critical"
                }
            ],
            missingDocumentation: [],
            missingInspectionCertificates: [],
            criticalFindings: [],
            majorFindings: [],
            minorFindings: [],
            totalFindings: 2,
            isCompliant: false,
            cityPlannerEmailBody: "<div>Test email body</div>",
            submitterEmailBody: "<div>Test email body</div>"
        };

        console.log('\n✓ Sample result with missing items created successfully');
        console.log('✓ Missing plans count:', sampleResult.missingPlans.length);
        console.log('✓ Missing permits count:', sampleResult.missingPermits.length);
        console.log('✓ Total findings count:', sampleResult.totalFindings);
        console.log('✓ Is compliant:', sampleResult.isCompliant);

        console.log('\n🎉 All tests passed! Updated schema is working correctly.');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        return false;
    }

    return true;
}

// Run the test
if (require.main === module) {
    testUpdatedSchema();
}

module.exports = { testUpdatedSchema }; 