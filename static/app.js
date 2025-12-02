// Dashboard JavaScript

let reportSelect;
let reportContent;
let metricFiltersContainer;
let selectAllBtn;
let deselectAllBtn;
let summaryTableContainer;

let currentReportData = null;
let selectedMetrics = new Set();
let videoObserver = null;

function initializeElements() {
    reportSelect = document.getElementById('report-select');
    reportContent = document.getElementById('report-content');
    metricFiltersContainer = document.getElementById('metric-filters');
    selectAllBtn = document.getElementById('select-all');
    deselectAllBtn = document.getElementById('deselect-all');
    summaryTableContainer = document.getElementById('summary-table-container');
    
    const elements = {
        'report-select': reportSelect,
        'report-content': reportContent,
        'metric-filters': metricFiltersContainer,
        'select-all': selectAllBtn,
        'deselect-all': deselectAllBtn,
        'summary-table-container': summaryTableContainer
    };
    
    const missing = Object.entries(elements)
        .filter(([name, elem]) => !elem)
        .map(([name]) => name);
    
    if (missing.length > 0) {
        console.error('Required DOM elements not found:', missing);
        console.log('Available element IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
        return false;
    }
    return true;
}

async function loadReport(reportIdx) {
    // Immediately hide old content and show loading
    summaryTableContainer.style.display = 'none';
    
    // Clean up previous lazy loading observer
    cleanupLazyVideoLoading();
    
    reportContent.innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading-text">Loading report...</div></div>';
    
    try {
        const response = await fetch(`/api/report/${reportIdx}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        currentReportData = data;
        // Debug: check if composite data is present
        if (data.video_pairs && data.video_pairs.length > 0) {
            console.log('First video pair composite:', data.video_pairs[0].composite);
        }
        initializeMetricFilters(data);
        renderSummaryTable(data);
        renderReport(data);
    } catch (error) {
        summaryTableContainer.style.display = 'none';
        reportContent.innerHTML = `<div class="error">Error loading report: ${error.message}</div>`;
    }
}

function initializeMetricFilters(data) {
    // Collect all unique metrics from all video pairs
    const allMetrics = new Set();
    
    if (data.video_pairs) {
        data.video_pairs.forEach(pair => {
            if (pair.metrics) {
                Object.keys(pair.metrics).forEach(metric => allMetrics.add(metric));
            }
        });
    }
    
    // Convert to sorted array
    const sortedMetrics = Array.from(allMetrics).sort((a, b) => a.localeCompare(b));
    
    // Initialize all metrics as selected
    selectedMetrics = new Set(sortedMetrics);
    
    // Render filter checkboxes
    if (sortedMetrics.length === 0) {
        metricFiltersContainer.innerHTML = '<div class="loading-filters">No metrics available</div>';
        return;
    }
    
    let html = '';
    sortedMetrics.forEach(metric => {
        html += `
            <label class="metric-filter-item">
                <input type="checkbox" class="metric-checkbox" value="${escapeHtml(metric)}" checked>
                <span class="metric-name">${escapeHtml(metric)}</span>
            </label>
        `;
    });
    
    metricFiltersContainer.innerHTML = html;
    
    // Add event listeners to checkboxes
    const checkboxes = metricFiltersContainer.querySelectorAll('.metric-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handleMetricFilterChange);
    });
}

function handleMetricFilterChange(e) {
    const metric = e.target.value;
    
    if (e.target.checked) {
        selectedMetrics.add(metric);
    } else {
        selectedMetrics.delete(metric);
    }
    
    // Re-render the report with filtered metrics
    if (currentReportData) {
        renderSummaryTable(currentReportData);
        renderReport(currentReportData);
    }
}

function renderSummaryTable(data) {
    if (!data.video_pairs || data.video_pairs.length === 0) {
        summaryTableContainer.style.display = 'none';
        return;
    }
    
    const videoPairs = data.video_pairs;
    const totalPairs = videoPairs.length;
    
    const metricStats = {};
    const compositeStats = {
        generated: [],
        reference: [],
        pctDiffs: []
    };
    
    videoPairs.forEach(pair => {
        const composite = calculateComposite(pair.metrics);
        if (composite && composite.generated_score != null) {
            compositeStats.generated.push(composite.generated_score);
            if (composite.reference_score != null) {
                compositeStats.reference.push(composite.reference_score);
            }
            if (composite.pct_diff != null) {
                compositeStats.pctDiffs.push(composite.pct_diff);
            }
        }
        
        if (pair.metrics) {
            Object.entries(pair.metrics).forEach(([metricName, metricData]) => {
                if (!metricStats[metricName]) {
                    metricStats[metricName] = {
                        generated: [],
                        reference: [],
                        pctDiffs: []
                    };
                }
                
                if (metricData.generated_score != null) {
                    metricStats[metricName].generated.push(metricData.generated_score);
                }
                if (metricData.reference_score != null) {
                    metricStats[metricName].reference.push(metricData.reference_score);
                }
                if (metricData.pct_diff != null) {
                    metricStats[metricName].pctDiffs.push(metricData.pct_diff);
                }
            });
        }
    });
    
    // Calculate statistics
    function calculateStats(values) {
        if (values.length === 0) return null;
        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);
        return {
            avg: sum / values.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted.length % 2 === 0
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)]
        };
    }
    
    // Build summary table HTML
    let html = `
        <table class="summary-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Avg Generated</th>
                    <th>Avg Reference</th>
                    <th>Avg % Diff</th>
                    <th>Min</th>
                    <th>Max</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    // Add composite row if available
    if (compositeStats.generated.length > 0) {
        const genStats = calculateStats(compositeStats.generated);
        const refStats = calculateStats(compositeStats.reference);
        const pctDiffStats = calculateStats(compositeStats.pctDiffs);
        
        const genAvgStr = genStats ? genStats.avg.toFixed(3) : '—';
        const refAvgStr = refStats ? refStats.avg.toFixed(3) : '—';
        const pctDiffAvgStr = pctDiffStats ? `${pctDiffStats.avg >= 0 ? '+' : ''}${pctDiffStats.avg.toFixed(2)}%` : '—';
        const minStr = genStats ? genStats.min.toFixed(3) : '—';
        const maxStr = genStats ? genStats.max.toFixed(3) : '—';
        
        const bgColor = pctDiffStats ? getHeatmapColor(pctDiffStats.avg) : '#ffffff';
        
        html += `
            <tr class="summary-composite-row">
                <td class="summary-composite-metric">Composite</td>
                <td class="summary-composite-score">${genAvgStr}</td>
                <td>${refAvgStr}</td>
                <td class="summary-pct-diff" style="background-color: ${bgColor};">${pctDiffAvgStr}</td>
                <td>${minStr}</td>
                <td>${maxStr}</td>
            </tr>
        `;
    }
    
    // Add metric rows
    const sortedMetrics = Object.entries(metricStats)
        .filter(([metricName]) => selectedMetrics.has(metricName))
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [metricName, stats] of sortedMetrics) {
        const genStats = calculateStats(stats.generated);
        const refStats = calculateStats(stats.reference);
        const pctDiffStats = calculateStats(stats.pctDiffs);
        
        const genAvgStr = genStats ? genStats.avg.toFixed(3) : '—';
        const refAvgStr = refStats ? refStats.avg.toFixed(3) : '—';
        const pctDiffAvgStr = pctDiffStats ? `${pctDiffStats.avg >= 0 ? '+' : ''}${pctDiffStats.avg.toFixed(2)}%` : '—';
        const minStr = genStats ? genStats.min.toFixed(3) : '—';
        const maxStr = genStats ? genStats.max.toFixed(3) : '—';
        
        const bgColor = pctDiffStats ? getHeatmapColor(pctDiffStats.avg) : '#ffffff';
        
        html += `
            <tr>
                <td>${escapeHtml(metricName)}</td>
                <td>${genAvgStr}</td>
                <td>${refAvgStr}</td>
                <td class="summary-pct-diff" style="background-color: ${bgColor};">${pctDiffAvgStr}</td>
                <td>${minStr}</td>
                <td>${maxStr}</td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
        <div class="summary-footer">
            <span class="summary-count">Total Video Pairs: <strong>${totalPairs}</strong></span>
        </div>
    `;
    
    const summaryWrapper = document.getElementById('summary-table-wrapper');
    summaryWrapper.innerHTML = html;
    summaryTableContainer.style.display = 'block';
}

function renderReport(data) {
    if (!data.video_pairs || data.video_pairs.length === 0) {
        reportContent.innerHTML = '<div class="loading">No video pairs found in this report.</div>';
        return;
    }
    
    let html = '';
    
    for (let i = 0; i < data.video_pairs.length; i++) {
        const pair = data.video_pairs[i];
        const metricsHtml = renderMetrics(pair.metrics, pair.composite);
        const pairId = `pair-${i}`;
        
        html += `
            <div class="video-pair" data-pair-id="${pairId}">
                <div class="video-pair-id">${escapeHtml(pair.id)}</div>
                ${pair.prompt ? `<div class="video-pair-prompt">${escapeHtml(pair.prompt)}</div>` : ''}
                
                <div class="comparison-container" data-pair="${pairId}">
                    <div class="metrics-panel">
                        <div class="metrics-table-wrapper">
                            ${metricsHtml}
                        </div>
                    </div>
                    
                    <div class="resize-handle">
                        <div class="resize-handle-bar"></div>
                    </div>
                    
                    <div class="videos-panel">
                        <div class="videos-row">
                            <div class="video-column">
                                <div class="video-label reference-label">Reference Video</div>
                                <video class="sync-video lazy-video" data-pair="${pairId}" data-video-type="reference" preload="none" data-src="/video${pair.reference}">
                                    Your browser does not support video playback.
                                </video>
                            </div>
                            
                            <div class="video-column">
                                <div class="video-label generated-label">Generated Video</div>
                                <video class="sync-video lazy-video" data-pair="${pairId}" data-video-type="generated" preload="none" data-src="/video${pair.video}">
                                    Your browser does not support video playback.
                                </video>
                            </div>
                        </div>
                        
                        <div class="video-controls">
                            <button class="play-btn" data-pair="${pairId}">
                                <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M8 5v14l11-7z"/>
                                </svg>
                                <svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                </svg>
                            </button>
                            <div class="time-display">
                                <span class="current-time">0:00</span>
                                <span class="separator">/</span>
                                <span class="duration">0:00</span>
                            </div>
                            <input type="range" class="seek-slider" data-pair="${pairId}" min="0" max="100" value="0" step="0.1">
                            <div class="speed-control">
                                <button class="speed-btn" data-pair="${pairId}" data-speed="1">1x</button>
                                <button class="speed-btn" data-pair="${pairId}" data-speed="0.5">0.5x</button>
                                <button class="speed-btn" data-pair="${pairId}" data-speed="0.25">0.25x</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    reportContent.innerHTML = html;
    initializeLazyVideoLoading();
    initializeVideoControls();
    initializeResizablePanels();
}

function calculatePctDiff(generated, reference) {
    if (reference === null || reference === undefined || reference === 0) {
        return null;
    }
    return ((generated - reference) / reference) * 100;
}

function calculateComposite(metrics) {
    if (!metrics) return null;
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let totalWeightedRef = 0;
    let hasReference = false;
    
    for (const [metricName, metricData] of Object.entries(metrics)) {
        if (!selectedMetrics.has(metricName)) continue;
        if (metricData.generated_score == null) continue;
        
        const weight = metricData.weight || 1.0;
        totalWeightedScore += weight * metricData.generated_score;
        totalWeight += weight;
        
        if (metricData.reference_score != null) {
            totalWeightedRef += weight * metricData.reference_score;
            hasReference = true;
        }
    }
    
    if (totalWeight === 0) return null;
    
    const genComposite = totalWeightedScore / totalWeight;
    const refComposite = hasReference ? totalWeightedRef / totalWeight : null;
    const pctDiff = (refComposite != null && refComposite !== 0) 
        ? ((genComposite - refComposite) / refComposite) * 100 
        : null;
    
    return {
        generated_score: genComposite,
        reference_score: refComposite,
        pct_diff: pctDiff
    };
}

function getHeatmapColor(pctDiff) {
    if (pctDiff === null || pctDiff === undefined) {
        return '#ffffff';
    }
    
    // Use a more sensitive range: -20% to +20% for full color transition
    // This makes smaller differences more visible
    const colorRange = 20; // ±20% for full color range
    const clamped = Math.max(-colorRange, Math.min(colorRange, pctDiff));
    
    // Normalize to 0-1 scale where 0 = -20%, 0.5 = 0%, 1 = +20%
    const normalized = (clamped + colorRange) / (colorRange * 2);
    
    // Interpolate between red and green through white
    // At normalized = 0 (pctDiff = -20% or less): red (255, 180, 180)
    // At normalized = 0.5 (pctDiff = 0%): white (255, 255, 255)
    // At normalized = 1 (pctDiff = +20% or more): green (180, 255, 180)
    
    let red, green, blue;
    
    if (normalized < 0.5) {
        // Interpolate from red to white (normalized 0 to 0.5)
        const t = normalized * 2; // Scale to 0-1
        red = 255;
        green = Math.floor(180 + (75 * t)); // 180 to 255
        blue = Math.floor(180 + (75 * t));  // 180 to 255
    } else {
        // Interpolate from white to green (normalized 0.5 to 1)
        const t = (normalized - 0.5) * 2; // Scale to 0-1
        red = Math.floor(255 - (75 * t));   // 255 to 180
        green = 255;
        blue = Math.floor(255 - (75 * t));  // 255 to 180
    }
    
    return `rgb(${red}, ${green}, ${blue})`;
}

function renderMetrics(metrics, originalComposite) {
    if (!metrics || Object.keys(metrics).length === 0) {
        return '<div class="loading">No metrics available</div>';
    }
    
    const composite = calculateComposite(metrics);
    
    let html = `
        <table class="metrics-table">
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Reference</th>
                    <th>Generated</th>
                    <th>% Diff</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (composite && composite.generated_score != null) {
        const genScore = composite.generated_score;
        const refScore = composite.reference_score;
        
        const refScoreStr = refScore !== null && refScore !== undefined 
            ? refScore.toFixed(3) 
            : '—';
        const genScoreStr = genScore.toFixed(3);
        
        const pctDiff = composite.pct_diff;
        const pctDiffStr = pctDiff !== null 
            ? `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(2)}%`
            : '—';
        
        const bgColor = pctDiff !== null ? getHeatmapColor(pctDiff) : null;
        const pctDiffStyle = bgColor ? `background-color: ${bgColor};` : '';
        
        html += `
            <tr class="composite-row">
                <td class="composite-metric">Composite</td>
                <td class="composite-score">${refScoreStr}</td>
                <td class="composite-score">${genScoreStr}</td>
                <td class="pct-diff-cell composite-pct" style="${pctDiffStyle}">${pctDiffStr}</td>
            </tr>
        `;
    }
    
    // Sort metrics alphabetically for consistent display and filter by selected
    const sortedMetrics = Object.entries(metrics || {})
        .filter(([metricName]) => selectedMetrics.has(metricName))
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [metricName, metricData] of sortedMetrics) {
        const genScore = metricData.generated_score;
        const refScore = metricData.reference_score;
        const qualityLabel = metricData.quality_label;
        
        const refScoreStr = refScore !== null && refScore !== undefined 
            ? refScore.toFixed(3) 
            : '—';
        const genScoreStr = genScore.toFixed(3);
        
        let diffDisplayStr = '—';
        let bgColor = null;
        
        if (qualityLabel) {
            const qualityColors = {
                'poor': 'rgba(139, 0, 0, 0.3)',
                'fair': 'rgba(184, 134, 11, 0.3)',
                'good': 'rgba(46, 139, 87, 0.3)',
                'excellent': 'rgba(30, 144, 255, 0.3)'
            };
            bgColor = qualityColors[qualityLabel] || null;
            diffDisplayStr = qualityLabel.charAt(0).toUpperCase() + qualityLabel.slice(1);
        } else {
            const pctDiff = calculatePctDiff(genScore, refScore);
            if (pctDiff !== null) {
                diffDisplayStr = `${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(2)}%`;
                bgColor = getHeatmapColor(pctDiff);
            }
        }
        
        const pctDiffStyle = bgColor ? `background-color: ${bgColor};` : '';
        
        html += `
            <tr>
                <td>${escapeHtml(metricName)}</td>
                <td>${refScoreStr}</td>
                <td>${genScoreStr}</td>
                <td class="pct-diff-cell" style="${pctDiffStyle}">${diffDisplayStr}</td>
            </tr>
        `;
    }
    
    html += `
            </tbody>
        </table>
    `;
    
    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function initializeLazyVideoLoading() {
    // Disconnect previous observer if it exists
    if (videoObserver) {
        videoObserver.disconnect();
        videoObserver = null;
    }
    
    const lazyVideos = document.querySelectorAll('.lazy-video');
    
    if (lazyVideos.length === 0) return;
    
    // Track which videos are already being loaded to prevent duplicate loads
    const loadingVideos = new Set();
    
    // Create Intersection Observer
    videoObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const video = entry.target;
                const videoSrc = video.getAttribute('data-src');
                
                // Check if video already has a source element or is already loading
                const hasSource = video.querySelector('source') !== null;
                const videoId = video.getAttribute('data-pair') + '-' + video.getAttribute('data-video-type');
                const isAlreadyLoading = loadingVideos.has(videoId);
                
                if (videoSrc && !hasSource && !isAlreadyLoading) {
                    // Mark as loading immediately to prevent duplicate loads
                    loadingVideos.add(videoId);
                    
                    // Unobserve immediately to prevent callback from firing again
                    observer.unobserve(video);
                    
                    // Create source element and add it to video
                    const source = document.createElement('source');
                    source.src = videoSrc;
                    source.type = 'video/mp4';
                    video.appendChild(source);
                    
                    // Mark as loaded by removing lazy-video class
                    video.classList.remove('lazy-video');
                    
                    // Load metadata when video is about to be visible
                    video.load();
                    
                    // Once metadata is loaded, update duration in video controls
                    video.addEventListener('loadedmetadata', () => {
                        const pairId = video.getAttribute('data-pair');
                        const durationDisplay = document.querySelector(`.video-pair[data-pair-id="${pairId}"] .duration`);
                        const seekSlider = document.querySelector(`.seek-slider[data-pair="${pairId}"]`);
                        if (durationDisplay && video.duration) {
                            durationDisplay.textContent = formatTime(video.duration);
                        }
                        if (seekSlider && video.duration) {
                            seekSlider.max = video.duration;
                        }
                    }, { once: true });
                }
            }
        });
    }, {
        // Start loading when video is 200px away from viewport
        rootMargin: '200px'
    });
    
    // Observe all lazy videos
    lazyVideos.forEach(video => {
        videoObserver.observe(video);
    });
}

// Clean up observer when switching reports
function cleanupLazyVideoLoading() {
    if (videoObserver) {
        videoObserver.disconnect();
        videoObserver = null;
    }
}

function initializeResizablePanels() {
    const containers = document.querySelectorAll('.comparison-container');
    
    containers.forEach(container => {
        const metricsPanel = container.querySelector('.metrics-panel');
        const videosPanel = container.querySelector('.videos-panel');
        const resizeHandle = container.querySelector('.resize-handle');
        const videosRow = container.querySelector('.videos-row');
        
        let isResizing = false;
        let startX = 0;
        let startMetricsWidth = 0;
        
        // Set initial widths
        metricsPanel.style.width = '45%';
        videosPanel.style.width = 'calc(55% - 16px)'; // 16px for handle + gap
        
        function updateVideoLayout() {
            const containerWidth = container.offsetWidth;
            const videosWidth = videosPanel.offsetWidth;
            const videosPercentage = (videosWidth / containerWidth) * 100;
            
            if (videosPercentage < 60) {
                videosRow.classList.add('vertical');
            } else {
                videosRow.classList.remove('vertical');
            }
        }
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startMetricsWidth = metricsPanel.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const containerWidth = container.offsetWidth;
            const deltaX = e.clientX - startX;
            const newMetricsWidth = startMetricsWidth + deltaX;
            const metricsPercentage = (newMetricsWidth / containerWidth) * 100;
            
            // Limit metrics panel to 20-70% of container width
            if (metricsPercentage >= 20 && metricsPercentage <= 70) {
                const videosPercentage = 100 - metricsPercentage;
                metricsPanel.style.width = `${metricsPercentage}%`;
                videosPanel.style.width = `calc(${videosPercentage}% - 16px)`;
                updateVideoLayout();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
        
        // Initial layout check
        updateVideoLayout();
        
        // Update on window resize
        window.addEventListener('resize', updateVideoLayout);
    });
}

function initializeVideoControls() {
    const videoPairs = document.querySelectorAll('.video-pair');
    
    videoPairs.forEach(pairElement => {
        const pairId = pairElement.dataset.pairId;
        const videos = pairElement.querySelectorAll(`.sync-video[data-pair="${pairId}"]`);
        const playBtn = pairElement.querySelector(`.play-btn[data-pair="${pairId}"]`);
        const seekSlider = pairElement.querySelector(`.seek-slider[data-pair="${pairId}"]`);
        const currentTimeDisplay = pairElement.querySelector('.current-time');
        const durationDisplay = pairElement.querySelector('.duration');
        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');
        
        let isUpdatingSlider = false;
        
        // Function to update duration - can be called when metadata loads
        const updateDuration = (video) => {
            if (video && video.duration && !isNaN(video.duration)) {
                durationDisplay.textContent = formatTime(video.duration);
                seekSlider.max = video.duration;
            }
        };
        
        // Update duration when metadata is loaded (for both videos)
        videos.forEach(video => {
            if (video.readyState >= 1) {
                // Video already has metadata
                updateDuration(video);
            } else {
                // Wait for metadata to load
                video.addEventListener('loadedmetadata', () => {
                    updateDuration(video);
                }, { once: true });
            }
        });
        
        // Play/Pause button
        playBtn.addEventListener('click', () => {
            // Check if videos are loaded
            const allLoaded = Array.from(videos).every(v => v.readyState >= 1);
            if (!allLoaded) {
                // Videos not loaded yet, wait for them to load
                Promise.all(Array.from(videos).map(v => {
                    if (v.readyState >= 1) {
                        return Promise.resolve();
                    }
                    return new Promise(resolve => {
                        v.addEventListener('loadedmetadata', resolve, { once: true });
                    });
                })).then(() => {
                    // Now play the videos
                    videos.forEach(video => video.play());
                    playIcon.style.display = 'none';
                    pauseIcon.style.display = 'block';
                });
                return;
            }
            
            const isPlaying = !videos[0].paused;
            
            if (isPlaying) {
                videos.forEach(video => video.pause());
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            } else {
                videos.forEach(video => video.play());
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            }
        });
        
        // Update slider and time as videos play
        videos[0].addEventListener('timeupdate', () => {
            if (!isUpdatingSlider) {
                const currentTime = videos[0].currentTime;
                seekSlider.value = currentTime;
                currentTimeDisplay.textContent = formatTime(currentTime);
            }
        });
        
        // Seek functionality - pause videos when slider is moved
        seekSlider.addEventListener('mousedown', () => {
            const wasPlaying = !videos[0].paused;
            if (wasPlaying) {
                videos.forEach(video => video.pause());
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        });
        
        seekSlider.addEventListener('input', (e) => {
            isUpdatingSlider = true;
            const seekTime = parseFloat(e.target.value);
            videos.forEach(video => {
                video.currentTime = seekTime;
            });
            currentTimeDisplay.textContent = formatTime(seekTime);
        });
        
        seekSlider.addEventListener('change', () => {
            isUpdatingSlider = false;
        });
        
        // Pause both videos when either ends
        videos.forEach(video => {
            video.addEventListener('ended', () => {
                // Pause all videos and set them to the end
                videos.forEach(v => {
                    v.pause();
                    // Set to end of video if duration is available
                    if (v.duration && !isNaN(v.duration)) {
                        v.currentTime = v.duration;
                    }
                });
                // Update UI
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                // Update slider and time display
                if (videos[0].duration && !isNaN(videos[0].duration)) {
                    seekSlider.value = videos[0].duration;
                    currentTimeDisplay.textContent = formatTime(videos[0].duration);
                }
            });
        });
        
        // Sync videos if they drift apart
        videos[0].addEventListener('play', () => {
            const syncVideos = () => {
                if (videos[0].paused) return;
                
                const masterTime = videos[0].currentTime;
                videos.forEach((video, index) => {
                    if (index > 0 && Math.abs(video.currentTime - masterTime) > 0.3) {
                        video.currentTime = masterTime;
                    }
                });
                
                requestAnimationFrame(syncVideos);
            };
            syncVideos();
        });
        
        // Playback speed control
        const speedButtons = pairElement.querySelectorAll(`.speed-btn[data-pair="${pairId}"]`);
        let currentSpeed = 1;
        
        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseFloat(btn.getAttribute('data-speed'));
                currentSpeed = speed;
                
                // Apply speed to all videos
                videos.forEach(video => {
                    video.playbackRate = speed;
                });
                
                // Update button states
                speedButtons.forEach(b => {
                    if (parseFloat(b.getAttribute('data-speed')) === speed) {
                        b.classList.add('active');
                    } else {
                        b.classList.remove('active');
                    }
                });
            });
        });
        
        // Set initial speed (1x) as active
        speedButtons.forEach(btn => {
            if (parseFloat(btn.getAttribute('data-speed')) === 1) {
                btn.classList.add('active');
            }
        });
        
        // Initialize playback rate to 1x
        videos.forEach(video => {
            video.playbackRate = 1;
        });
    });
}

// Initialize the dashboard
function initializeDashboard() {
    if (!initializeElements()) {
        console.error('Failed to initialize dashboard - required elements missing');
        return;
    }
    
    // Event listeners
    reportSelect.addEventListener('change', (e) => {
        loadReport(e.target.value);
    });

    selectAllBtn.addEventListener('click', () => {
        const checkboxes = metricFiltersContainer.querySelectorAll('.metric-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            selectedMetrics.add(checkbox.value);
        });
        if (currentReportData) {
            renderSummaryTable(currentReportData);
            renderReport(currentReportData);
        }
    });

    deselectAllBtn.addEventListener('click', () => {
        const checkboxes = metricFiltersContainer.querySelectorAll('.metric-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            selectedMetrics.delete(checkbox.value);
        });
        if (currentReportData) {
            renderSummaryTable(currentReportData);
            renderReport(currentReportData);
        }
    });

    // Load first report on page load
    loadReport(0);
}

// Initialize when DOM is ready (handle both cases: already loaded or still loading)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    // DOM already loaded
    initializeDashboard();
}

