
document.addEventListener('DOMContentLoaded', () => {

    // --- Data Configuration ---
    const coverageData = {
        'wind': {
            'zone-roof': { status: 'covered', text: 'Covered up to 80%', icon: '✅' },
            'zone-walls-left': { status: 'covered', text: 'Covered (structure)', icon: '✅' },
            'zone-walls-right': { status: 'covered', text: 'Covered (structure)', icon: '✅' },
            'zone-window-1': { status: 'conditional', text: 'Deductible applies (5%)', icon: '⚠' },
            'zone-window-2': { status: 'conditional', text: 'Deductible applies (5%)', icon: '⚠' },
            'zone-basement': { status: 'unknown', text: 'Check policy details', icon: '❓' },
            'zone-ground': { status: 'excluded', text: 'Landscaping excluded', icon: '⛔' }
        },
        'hail': {
            'zone-roof': { status: 'conditional', text: 'Avg 100% (Material info req)', icon: '⚠' },
            'zone-walls-left': { status: 'covered', text: 'Covered', icon: '✅' },
            'zone-walls-right': { status: 'covered', text: 'Covered', icon: '✅' },
            'zone-window-1': { status: 'covered', text: 'Covered', icon: '✅' },
            'zone-window-2': { status: 'covered', text: 'Covered', icon: '✅' },
            'zone-basement': { status: 'unknown', text: 'N/A', icon: '❓' },
            'zone-ground': { status: 'excluded', text: 'Cosmetic damage excluded', icon: '⛔' }
        },
        'flood': {
            'zone-roof': { status: 'excluded', text: 'Rain allowed, Flood excluded', icon: '⛔' },
            'zone-walls-left': { status: 'excluded', text: 'Surface water excluded', icon: '⛔' },
            'zone-walls-right': { status: 'excluded', text: 'Surface water excluded', icon: '⛔' },
            'zone-window-1': { status: 'excluded', text: 'Excluded', icon: '⛔' },
            'zone-window-2': { status: 'excluded', text: 'Excluded', icon: '⛔' },
            'zone-basement': { status: 'excluded', text: 'Excluded (Surface water)', icon: '⛔' },
            'zone-ground': { status: 'excluded', text: 'Excluded', icon: '⛔' }
        },
        'all': {
            // Simplified "All" view - maybe showing 'worst case' or 'general'
             'zone-roof': { status: 'covered', text: 'Generally Covered', icon: '✅' },
             'zone-walls-left': { status: 'covered', text: 'Generally Covered', icon: '✅' },
             'zone-walls-right': { status: 'covered', text: 'Generally Covered', icon: '✅' },
             'zone-window-1': { status: 'conditional', text: 'Policy Specifics Apply', icon: '⚠' },
             'zone-window-2': { status: 'conditional', text: 'Policy Specifics Apply', icon: '⚠' },
             'zone-basement': { status: 'excluded', text: 'Flood Excluded', icon: '⛔' },
             'zone-ground': { status: 'excluded', text: 'Excluded', icon: '⛔' }
        }
    };

    let currentPeril = 'wind';

    // --- Map Logic ---
    const zones = document.querySelectorAll('.zone');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    const tooltip = document.getElementById('mapTooltip');
    const ttTitle = document.getElementById('tt-title');
    const ttIcon = document.getElementById('tt-icon');
    const ttDesc = document.getElementById('tt-desc');

    function updateMap(peril) {
        currentPeril = peril;
        const data = coverageData[peril];
        
        zones.forEach(zone => {
            // Remove old status classes
            zone.classList.remove('covered', 'excluded', 'conditional', 'unknown');
            
            const zoneId = zone.id;
            if (data[zoneId]) {
                zone.classList.add(data[zoneId].status);
            } else {
                zone.classList.add('unknown');
            }
        });

        // Update Toggle Buttons
        toggleBtns.forEach(btn => {
            if (btn.dataset.view === peril) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Sync Accordion if applicable (optional UX: clicking map toggle expands relevant accordion)
         const relevantAccordion = document.querySelector(`.accordion-item[data-peril="${peril}"]`);
         if (relevantAccordion && !relevantAccordion.classList.contains('active')) {
             // Close others
             document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));
             relevantAccordion.classList.add('active');
         }
    }

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            updateMap(btn.dataset.view);
        });
    });

    // Tooltip Interaction
    zones.forEach(zone => {
        zone.addEventListener('mouseenter', (e) => {
            const data = coverageData[currentPeril][zone.id];
            if (!data) return;

            ttTitle.textContent = formatZoneName(zone.id);
            ttIcon.textContent = data.icon;
            ttDesc.textContent = data.text;
            
            tooltip.classList.remove('hidden');
        });

        zone.addEventListener('mousemove', (e) => {
             // Position tooltip near mouse but offset
             // Get container offset
             const containerRect = document.querySelector('.map-visualization-area').getBoundingClientRect();
             const x = e.clientX - containerRect.left + 15;
             const y = e.clientY - containerRect.top + 15;
             
             tooltip.style.left = `${x}px`;
             tooltip.style.top = `${y}px`;
        });

        zone.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    });

    function formatZoneName(id) {
        if (id.includes('roof')) return 'Roof';
        if (id.includes('walls')) return 'Ext. Walls';
        if (id.includes('window')) return 'Windows';
        if (id.includes('basement')) return 'Basement';
        if (id.includes('ground')) return 'Grounds';
        return 'Property Zone';
    }

    // --- Accordion Logic ---
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.parentElement;
            const isActive = item.classList.contains('active');
            
            // Close all
            document.querySelectorAll('.accordion-item').forEach(i => i.classList.remove('active'));

            // Open clicked if it wasn't open
            if (!isActive) {
                item.classList.add('active');
                // Sync map view
                const peril = item.dataset.peril;
                if (peril && coverageData[peril]) {
                    updateMap(peril);
                }
            }
        });
    });

    // --- Timeline Interaction ---
    const scrubber = document.getElementById('scrubber');
    const track = document.querySelector('.timeline-track-container');
    const statusPill = document.querySelector('.current-status-pill');
    const statusText = document.getElementById('timeline-status-text');
    let isDragging = false;

    scrubber.addEventListener('mousedown', () => isDragging = true);
    document.addEventListener('mouseup', () => {
        isDragging = false;
        statusPill.style.opacity = '0';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const trackRect = track.getBoundingClientRect();
        let newLeft = e.clientX - trackRect.left;
        
        // Boundaries
        if (newLeft < 0) newLeft = 0;
        if (newLeft > trackRect.width) newLeft = trackRect.width;
        
        scrubber.style.left = `${newLeft}px`;

        // Update Pill Logic (Simulated)
        statusPill.style.opacity = '1';
        
        const pct = newLeft / trackRect.width;
        if (pct < 0.3) statusText.innerText = "Jan '23: Active Policy";
        else if (pct < 0.5) statusText.innerText = "Mar '23: Hail Event - Denied";
        else if (pct < 0.7) statusText.innerText = "Sep '23: Wind Event - Review";
        else if (pct < 0.9) statusText.innerText = "Apr '24: Hail - Approved";
        else statusText.innerText = "Future: Projected Coverage";
    });

    // --- Drawer Logic ---
    const drawer = document.getElementById('policyDrawer');
    const closeDrawerBtn = document.getElementById('closeDrawer');
    const policyLinks = document.querySelectorAll('.policy-link');

    policyLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            drawer.classList.remove('hidden');
        });
    });

    closeDrawerBtn.addEventListener('click', () => {
        drawer.classList.add('hidden');
    });

    drawer.addEventListener('click', (e) => {
        if (e.target === drawer) {
            drawer.classList.add('hidden');
        }
    });

    // --- Init ---
    updateMap('wind');
});
