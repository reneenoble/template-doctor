/**
 * Trivy scanner utility functions for processing scan results and calculating security scores
 */
const { extractFilesFromZip } = require('./zip-utils');


/**
 * Processes Trivy scan results to extract detailed information about vulnerabilities, 
 * misconfigurations, secrets, and license issues
 * @param {Object} trivyResults - Parsed Trivy results from extractTrivyResults
 * @returns {Object} - Detailed analysis of the scan results
 */
function processTrivyResultsDetails(trivyResults, includeAllDetails = false) {
    // Aggregated counters for overall summary
    let totalMisconfigurations = 0;
    let criticalMisconfigurations = 0;
    let highMisconfigurations = 0;
    let mediumMisconfigurations = 0;
    let lowMisconfigurations = 0;
    let misconfigurationDetails = [];

    // Count vulnerabilities
    let totalVulnerabilities = 0;
    let criticalVulns = 0;
    let highVulns = 0;
    let mediumVulns = 0;
    let lowVulns = 0;
    let vulnerabilityDetails = [];

    // Count secrets and licenses
    let secretsFound = 0;
    let licenseIssues = 0;
    let secretDetails = [];
    let licenseDetails = [];

    // Create an object to store per-artifact results
    const artifactResults = {};

    // Analyze each Trivy result file for security issues
    for (const [filename, result] of Object.entries(trivyResults)) {
        // Initialize per-artifact counters and metadata
        const artifactInfo = {
            filename,
            artifactName: result.ArtifactName || 'unknown',
            artifactType: result.ArtifactType || 'unknown',
            imageId: '',
            repository: '',
            tag: '',
            digest: '',
            metadata: {},
            os: {
                family: '',
                name: '',
                version: ''
            },
            vulnerabilities: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                details: []
            },
            misconfigurations: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                details: []
            },
            secrets: {
                count: 0,
                details: []
            },
            licenses: {
                count: 0,
                details: []
            }
        };

        // Extract image metadata if available
        if (result.Metadata && includeAllDetails) {
            artifactInfo.metadata = result.Metadata;

            // Size info
            if (result.Metadata.Size) {
                artifactInfo.size = result.Metadata.Size;
            }

            // OS info
            if (result.Metadata.OS) {
                artifactInfo.os.family = result.Metadata.OS.Family || '';
                artifactInfo.os.name = result.Metadata.OS.Name || '';
                artifactInfo.os.version = result.Metadata.OS.Version || '';
            }

            // Image repository/tag info (from name or repo fields)
            if (result.Metadata.ImageID) {
                artifactInfo.imageId = result.Metadata.ImageID;
            }
            if (result.Metadata.RepoDigests && result.Metadata.RepoDigests.length > 0) {
                const digestParts = result.Metadata.RepoDigests[0].split('@');
                if (digestParts.length > 0) {
                    artifactInfo.repository = digestParts[0].split(':')[0];
                    artifactInfo.digest = digestParts.length > 1 ? digestParts[1] : '';
                }
            }
            if (result.Metadata.RepoTags && result.Metadata.RepoTags.length > 0) {
                const tagParts = result.Metadata.RepoTags[0].split(':');
                artifactInfo.repository = artifactInfo.repository || tagParts[0];
                artifactInfo.tag = tagParts.length > 1 ? tagParts[1] : 'latest';
            }
        }

        if (result.Results) {

            for (const scanResult of result.Results) {
                // Process misconfigurations
                if (scanResult.MisconfSummary) {
                    if (scanResult.MisconfSummary.Failures) {
                        totalMisconfigurations += scanResult.MisconfSummary.Failures;
                        artifactInfo.misconfigurations.total += scanResult.MisconfSummary.Failures;
                    }
                }

                if (scanResult.Misconfigurations && Array.isArray(scanResult.Misconfigurations)) {
                    for (const misconfig of scanResult.Misconfigurations) {
                        if (misconfig.Severity === 'CRITICAL') {
                            criticalMisconfigurations++;
                            artifactInfo.misconfigurations.critical++;
                        } else if (misconfig.Severity === 'HIGH') {
                            highMisconfigurations++;
                            artifactInfo.misconfigurations.high++;
                        } else if (misconfig.Severity === 'MEDIUM') {
                            mediumMisconfigurations++;
                            artifactInfo.misconfigurations.medium++;
                        } else if (misconfig.Severity === 'LOW') {
                            lowMisconfigurations++;
                            artifactInfo.misconfigurations.low++;
                        }

                        // Create misconfiguration detail object
                        const misconfigDetail = {
                            id: misconfig.ID,
                            title: misconfig.Title,
                            severity: misconfig.Severity,
                            target: scanResult.Target || misconfig.FilePath || 'unknown',
                            type: scanResult.Type || misconfig.Type || 'unknown',
                            message: misconfig.Message || 'No message provided',
                            resolution: misconfig.Resolution || 'No resolution provided'
                        };

                        // Add to global and per-artifact lists
                        if(includeAllDetails){
                            misconfigurationDetails.push(misconfigDetail);
                            artifactInfo.misconfigurations.details.push(misconfigDetail);
                        }
                    }
                }

                // Process vulnerabilities
                if (scanResult.Vulnerabilities && Array.isArray(scanResult.Vulnerabilities)) {
                    for (const vuln of scanResult.Vulnerabilities) {
                        totalVulnerabilities++;
                        artifactInfo.vulnerabilities.total++;

                        if (vuln.Severity === 'CRITICAL') {
                            criticalVulns++;
                            artifactInfo.vulnerabilities.critical++;
                        } else if (vuln.Severity === 'HIGH') {
                            highVulns++;
                            artifactInfo.vulnerabilities.high++;
                        } else if (vuln.Severity === 'MEDIUM') {
                            mediumVulns++;
                            artifactInfo.vulnerabilities.medium++;
                        } else if (vuln.Severity === 'LOW') {
                            lowVulns++;
                            artifactInfo.vulnerabilities.low++;
                        }

                        // Create vulnerability detail object
                        const vulnDetail = {
                            id: vuln.VulnerabilityID,
                            package: vuln.PkgName,
                            installedVersion: vuln.InstalledVersion,
                            fixedVersion: vuln.FixedVersion || 'Not available',
                            severity: vuln.Severity,
                            title: vuln.Title || 'N/A',
                            description: vuln.Description || 'N/A',
                            target: scanResult.Target || 'unknown'
                        };

                        // Add critical and high vulnerabilities to global details
                        if (vuln.Severity === 'CRITICAL' || vuln.Severity === 'HIGH') {
                            if(includeAllDetails){
                                vulnerabilityDetails.push(vulnDetail);
                            }
                        }

                        // Add all vulnerabilities to per-artifact details
                        if(includeAllDetails){
                            artifactInfo.vulnerabilities.details.push(vulnDetail);
                        }
                    }
                }

                // Process secrets
                if (scanResult.Secrets && Array.isArray(scanResult.Secrets)) {
                    secretsFound += scanResult.Secrets.length;
                    artifactInfo.secrets.count += scanResult.Secrets.length;

                    for (const secret of scanResult.Secrets) {
                        const secretDetail = {
                            category: secret.Category || 'Unknown',
                            title: secret.Title || 'Secret found',
                            target: scanResult.Target || secret.FilePath || 'unknown',
                            match: secret.Match ? secret.Match.substring(0, 10) + '...' : 'Hidden'
                        };

                        if(includeAllDetails){
                            secretDetails.push(secretDetail);
                            artifactInfo.secrets.details.push(secretDetail);
                        }
                    }
                }

                // Process license issues
                if (scanResult.Licenses && Array.isArray(scanResult.Licenses)) {
                    for (const license of scanResult.Licenses) {
                        if (license.Severity) {
                            licenseIssues++;
                            artifactInfo.licenses.count++;

                            const licenseDetail = {
                                pkgName: license.PkgName || 'Unknown',
                                license: license.Name || 'Unknown license',
                                severity: license.Severity || 'UNKNOWN',
                                target: scanResult.Target || 'unknown'
                            };

                            if(includeAllDetails){
                                licenseDetails.push(licenseDetail);
                                artifactInfo.licenses.details.push(licenseDetail);
                            }
                        }
                    }
                }
            }
        }

        // Store the artifact results
        artifactResults[filename] = artifactInfo;
    }

    // Find the primary artifact if there are multiple results
    let primaryArtifact = null;
    const artifactKeys = Object.keys(artifactResults);
    if (artifactKeys.length > 0) {
        // Look for container or image scan first
        primaryArtifact = artifactResults[artifactKeys.find(k =>
            artifactResults[k].artifactType === 'container' ||
            artifactResults[k].artifactType === 'image'
        ) || artifactKeys[0]];
    }

    // Return the processed results
    return {
        // Summary counters
        totalMisconfigurations,
        criticalMisconfigurations,
        highMisconfigurations,
        mediumMisconfigurations,
        lowMisconfigurations,
        misconfigurationDetails,
        totalVulnerabilities,
        criticalVulns,
        highVulns,
        mediumVulns,
        lowVulns,
        vulnerabilityDetails,
        secretsFound,
        licenseIssues,
        secretDetails,
        licenseDetails,

        // Artifact information
        artifacts: artifactResults,
        artifactCount: artifactKeys.length,

        // Primary artifact information (if available)
        artifactName: primaryArtifact ? primaryArtifact.artifactName : '',
        artifactType: primaryArtifact ? primaryArtifact.artifactType : '',
        imageId: primaryArtifact ? primaryArtifact.imageId : '',
        repository: primaryArtifact ? primaryArtifact.repository : '',
        tag: primaryArtifact ? primaryArtifact.tag : '',
        digest: primaryArtifact ? primaryArtifact.digest : '',
        os: primaryArtifact ? primaryArtifact.os : { family: '', name: '', version: '' }
    };
}

/**
 * Extracts Trivy results from ZIP archive containing scan results
 * @param {Object} context - Azure Functions context for logging
 * @param {ArrayBuffer} zipData - The ZIP file as an ArrayBuffer
 * @param {string} [correlationId] - Optional ID to correlate logs across operations
 * @returns {Promise<Object>} - Parsed Trivy results
 */
async function extractTrivyResults(context, zipData, correlationId = null) {
    const requestId = correlationId || `trivy-extract-${Date.now()}`;
    
    try {
        const files = await extractFilesFromZip(zipData, context, correlationId);
        context.log(`Extracted ${Object.keys(files).length} files from ZIP archive`, { 
            operation: 'extractTrivyResults',
            fileCount: Object.keys(files).length,
            requestId
        });

        // Look for Trivy results files in the extracted files
        const trivyResults = {};

        for (const [filename, content] of Object.entries(files)) {
            // Typically Trivy outputs JSON files with scan results
            if (filename.endsWith('.json')) {
                try {
                    const parsed = JSON.parse(content);
                    trivyResults[filename] = parsed;
                } catch (parseErr) {
                    context.log.warn(`Failed to parse JSON from ${filename}`, {
                        error: parseErr.message,
                        stack: parseErr.stack,
                        filename,
                        operation: 'extractTrivyResults',
                        requestId
                    });
                }
            }
        }

        context.log(`Found ${Object.keys(trivyResults).length} valid Trivy result files`, {
            operation: 'extractTrivyResults',
            validFiles: Object.keys(trivyResults).length,
            requestId
        });
        
        return trivyResults;
    } catch (err) {
        context.log.error(`Error extracting Trivy results`, {
            error: err.message,
            stack: err.stack,
            operation: 'extractTrivyResults',
            requestId
        });
        throw new Error(`Failed to extract Trivy results: ${err.message}`);
    }
}

module.exports = {
    extractTrivyResults,
    processTrivyResultsDetails
};
