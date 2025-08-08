// js/app.js

// --- Configuration ---
const API_PROXY_URL = 'https://YOUR_FUNCTION_REGION.functions.app/dpla-proxy'; // Placeholder
const CACHE_DURATION_HOURS = 24;
const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300; // Debounce search input
const DEMO_RECORD_COUNT = 200; // Total number of demo records to generate

// --- Date Range Definitions ---
const DATE_RANGES = {
    "before-1800": { start: null, end: 1799 },
    "1800-1900": { start: 1800, end: 1900 },
    "1900-1950": { start: 1900, end: 1950 },
    "1950-2000": { start: 1950, end: 2000 },
    "after-2000": { start: 2001, end: null }
};
// ----------------------------

// --- State Management ---
let appState = {
    allRecords: [],
    filteredRecords: [],
    currentView: 'tile', // 'list', 'compact-image', or 'tile'
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    // --- Filter State ---
    selectedTypes: [],
    selectedInstitutions: [],
    selectedDateRange: '',
    // ------------------
    isLoading: false,
    hasError: false
};

// --- DOM Elements ---
const elements = {
    listViewBtn: document.getElementById('listViewBtn'),
    compactImageViewBtn: document.getElementById('compactImageViewBtn'),
    tileViewBtn: document.getElementById('tileViewBtn'),
    searchInput: document.getElementById('searchInput'),
    contentArea: document.getElementById('contentArea'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    errorMessage: document.getElementById('errorMessage'),
    paginationControls: document.getElementById('paginationControls'),
    itemsPerPageSelect: document.getElementById('itemsPerPage'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    currentPageNum: document.getElementById('currentPageNum'),
    totalPagesNum: document.getElementById('totalPagesNum'),
    // --- Filter Elements (Custom UI) ---
    typeFilterButton: document.querySelector('#typeFilterContainer .dropdown-button'),
    typeFilterMenu: document.querySelector('#typeFilterContainer .dropdown-menu'),
    typeFilterSelect: document.getElementById('typeFilter'), // Hidden select
    institutionFilterButton: document.querySelector('#institutionFilterContainer .dropdown-button'),
    institutionFilterMenu: document.querySelector('#institutionFilterContainer .dropdown-menu'),
    institutionFilterSelect: document.getElementById('institutionFilter'), // Hidden select
    dateFilterButton: document.querySelector('#dateFilterContainer .dropdown-button'),
    dateFilterMenu: document.querySelector('#dateFilterContainer .dropdown-menu'),
    dateFilterSelect: document.getElementById('dateFilter'), // Hidden select
    dateFilterRadios: document.querySelectorAll('input[name="dateFilterGroup"]'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn')
    // ----------------------------------
};

// --- Utility Functions ---

function showElement(el) {
    el.classList.remove('hidden');
}

function hideElement(el) {
    el.classList.add('hidden');
}

function setLoading(isLoading) {
    appState.isLoading = isLoading;
    if (isLoading) {
        showElement(elements.loadingSpinner);
        hideElement(elements.contentArea);
        hideElement(elements.errorMessage);
        hideElement(elements.paginationControls);
    } else {
        hideElement(elements.loadingSpinner);
    }
}

function setError(hasError) {
    appState.hasError = hasError;
    if (hasError) {
        showElement(elements.errorMessage);
        hideElement(elements.contentArea);
        hideElement(elements.loadingSpinner);
        hideElement(elements.paginationControls);
    } else {
        hideElement(elements.errorMessage);
    }
}

// --- Cache Management (using localStorage) ---
const FULL_DATASET_CACHE_KEY = 'dpla_egypt_full_dataset_demo';

function isCacheValid(cachedItem) {
    if (!cachedItem || !cachedItem.timestamp) return false;
    const now = new Date().getTime();
    const cacheAgeHours = (now - cachedItem.timestamp) / (1000 * 60 * 60);
    return cacheAgeHours < CACHE_DURATION_HOURS;
}

function saveFullDatasetToCache(data) {
    try {
        const cacheItem = {
            timestamp: new Date().getTime(),
             data
        };
        localStorage.setItem(FULL_DATASET_CACHE_KEY, JSON.stringify(cacheItem));
        console.log("Full dataset saved to cache.");
    } catch (e) {
        console.warn("Could not save full dataset to localStorage", e);
    }
}

function loadFullDatasetFromCache() {
    try {
        const cachedItemString = localStorage.getItem(FULL_DATASET_CACHE_KEY);
        if (!cachedItemString) {
            console.log("No cached dataset found.");
            return null;
        }
        const cachedItem = JSON.parse(cachedItemString);
        if (isCacheValid(cachedItem)) {
            console.log("Loaded full dataset from cache.");
            return cachedItem.data;
        } else {
            console.log("Cached dataset expired, removing.");
            localStorage.removeItem(FULL_DATASET_CACHE_KEY);
            return null;
        }
    } catch (e) {
        console.warn("Could not load full dataset from localStorage", e);
        return null;
    }
}

// --- API Interaction (Placeholder/Demo) ---

async function fetchFullDplaDataset() {
    let fullDataset = loadFullDatasetFromCache();

    if (fullDataset) {
        return fullDataset;
    }

    setLoading(true);
    setError(false);

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        console.log("Generating new demo dataset...");
        fullDataset = generateDemoData(DEMO_RECORD_COUNT);
        saveFullDatasetToCache(fullDataset);
        return fullDataset;

    } catch (error) {
        console.error("Error fetching full dataset:", error);
        setError(true);
        return null;
    } finally {
        setLoading(false);
    }
}

// --- View Rendering ---

function renderListView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'list-view';

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'list-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.isShownAt || '#';

        const truncatedDescription = description.length > 200 ? description.substring(0, 200) + '...' : description;

        itemElement.innerHTML = `
            <h3>${title}</h3>
            <p>${truncatedDescription}</p>
            <p class="provider">Provider: ${provider}</p>
            <a href="${linkUrl}" target="_blank" class="view-link">View Record</a>
        `;
        listElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(listElement);
}

function renderTileView(records) {
    const gridElement = document.createElement('ul');
    gridElement.className = 'tile-view';

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'tile-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.isShownAt || '#';
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            let iconName = 'file';
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'gallery-vertical-end';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        itemElement.innerHTML = `
            <div class="tile-image-container">
                ${imageHtml}
            </div>
            <div class="tile-content">
                <h3>${title}</h3>
                <p class="provider">${provider}</p>
                <a href="${linkUrl}" target="_blank" class="view-link">View Record</a>
            </div>
        `;
        gridElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(gridElement);

    lucide.createIcons();
}

function renderCompactImageView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'compact-image-view';

    const headerRow = document.createElement('li');
    headerRow.className = 'compact-image-header';
    headerRow.innerHTML = `
        <div class="civ-col-image"></div>
        <div class="civ-col-title">Title</div>
        <div class="civ-col-description">Description</div>
        <div class="civ-col-date">Date Added</div>
        <div class="civ-col-institution">Institution</div>
        <div class="civ-col-link"></div>
    `;
    listElement.appendChild(headerRow);

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'compact-image-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const institution = record.provider?.name || 'Unknown Institution';
        const linkUrl = record.isShownAt || '#';
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}">`;
        } else {
            let iconName = 'file';
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'gallery-vertical-end';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        const randomDaysAgo = Math.floor(Math.random() * 365 * 3);
        const dateAdded = new Date();
        dateAdded.setDate(dateAdded.getDate() - randomDaysAgo);
        const formattedDate = dateAdded.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        itemElement.innerHTML = `
            <div class="civ-col-image">
                <div class="civ-image-container">
                    ${imageHtml}
                </div>
            </div>
            <div class="civ-col-title">${title}</div>
            <div class="civ-col-description">${description}</div>
            <div class="civ-col-date">${formattedDate}</div>
            <div class="civ-col-institution">${institution}</div>
            <div class="civ-col-link">
                <a href="${linkUrl}" target="_blank" aria-label="View Record on DPLA">
                    <i data-lucide="square-arrow-out-up-right"></i>
                </a>
            </div>
        `;
        listElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(listElement);

    lucide.createIcons();
}

// --- No Records Found Message ---
function renderNoRecordsMessage() {
    elements.contentArea.innerHTML = '<p class="no-records-message">No records found. Please adjust your search or filter terms.</p>';
    hideElement(elements.paginationControls);
}
// --------------------------------


function updatePaginationControls(totalRecords) {
    const totalPages = Math.ceil(totalRecords / appState.itemsPerPage);
    elements.totalPagesNum.textContent = totalPages;
    elements.currentPageNum.textContent = appState.currentPage;

    elements.prevPageBtn.disabled = appState.currentPage <= 1;
    elements.nextPageBtn.disabled = appState.currentPage >= totalPages;

    if (totalPages > 0) {
        showElement(elements.paginationControls);
    } else {
        hideElement(elements.paginationControls);
    }
}

function renderCurrentView() {
    const start = (appState.currentPage - 1) * appState.itemsPerPage;
    const end = start + appState.itemsPerPage;
    const recordsToShow = appState.filteredRecords.slice(start, end);

    if (recordsToShow.length === 0) {
        renderNoRecordsMessage();
        updatePaginationControls(0);
        return;
    }

    if (appState.currentView === 'list') {
        renderListView(recordsToShow);
    } else if (appState.currentView === 'tile') {
        renderTileView(recordsToShow);
    } else if (appState.currentView === 'compact-image') {
        renderCompactImageView(recordsToShow);
    }
    updatePaginationControls(appState.filteredRecords.length);
}


// --- Event Handlers ---

function setupEventListeners() {
    function setView(viewName) {
        appState.currentView = viewName;

        elements.listViewBtn.classList.remove('active');
        elements.compactImageViewBtn.classList.remove('active');
        elements.tileViewBtn.classList.remove('active');

        if (viewName === 'list') {
            elements.listViewBtn.classList.add('active');
        } else if (viewName === 'compact-image') {
            elements.compactImageViewBtn.classList.add('active');
        } else if (viewName === 'tile') {
            elements.tileViewBtn.classList.add('active');
        }

        renderCurrentView();
    }

    elements.listViewBtn.addEventListener('click', () => setView('list'));
    elements.compactImageViewBtn.addEventListener('click', () => setView('compact-image'));
    elements.tileViewBtn.addEventListener('click', () => setView('tile'));


    // --- Search with Debouncing ---
    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            appState.searchTerm = e.target.value.toLowerCase();
            appState.currentPage = 1;
            applyFiltersAndRender();
        }, SEARCH_DEBOUNCE_MS);
    });
    // ----------------------------


    // --- Pagination ---
    elements.itemsPerPageSelect.addEventListener('change', (e) => {
        appState.itemsPerPage = parseInt(e.target.value, 10);
        appState.currentPage = 1;
        renderCurrentView();
    });

    elements.prevPageBtn.addEventListener('click', () => {
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    elements.nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(appState.filteredRecords.length / appState.itemsPerPage);
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderCurrentView();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
    // ------------------


    // --- Custom Filter Dropdown Event Listeners ---

    // Generic function to toggle dropdown visibility
    function toggleDropdown(button, menu) {
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            menu.classList.remove('show');
            button.setAttribute('aria-expanded', 'false');
            button.classList.remove('active');
        } else {
            // Close all other dropdowns first
            closeAllDropdowns();
            menu.classList.add('show');
            button.setAttribute('aria-expanded', 'true');
            button.classList.add('active');
        }
    }

    // Function to close all custom dropdowns
    function closeAllDropdowns() {
        const allDropdowns = document.querySelectorAll('.custom-dropdown');
        allDropdowns.forEach(dropdown => {
            const btn = dropdown.querySelector('.dropdown-button');
            const mnu = dropdown.querySelector('.dropdown-menu');
            if (btn && mnu) {
                mnu.classList.remove('show');
                btn.setAttribute('aria-expanded', 'false');
                btn.classList.remove('active');
            }
        });
    }

    // Click outside to close dropdowns
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            closeAllDropdowns();
        }
    });

    // Type Filter
    if (elements.typeFilterButton && elements.typeFilterMenu) {
        elements.typeFilterButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener from closing it immediately
            toggleDropdown(elements.typeFilterButton, elements.typeFilterMenu);
        });
    }

    // Institution Filter
    if (elements.institutionFilterButton && elements.institutionFilterMenu) {
        elements.institutionFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.institutionFilterButton, elements.institutionFilterMenu);
        });
    }

    // Date Filter
    if (elements.dateFilterButton && elements.dateFilterMenu) {
        elements.dateFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.dateFilterButton, elements.dateFilterMenu);
        });
    }

    // Handle checkbox changes for Type and Institution
    // These listeners are attached dynamically after the menus are populated

    // Handle radio button changes for Date
    if (elements.dateFilterRadios.length > 0) {
        elements.dateFilterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    appState.selectedDateRange = e.target.value;
                    // Update button text
                    const selectedLabel = e.target.parentElement.textContent.trim();
                    if (elements.dateFilterButton) {
                        elements.dateFilterButton.textContent = selectedLabel || 'All Dates';
                    }
                    appState.currentPage = 1;
                    applyFiltersAndRender();
                    updateUrlParams();
                    // Close the dropdown menu after selection
                    if (elements.dateFilterMenu) {
                        elements.dateFilterMenu.classList.remove('show');
                        elements.dateFilterButton?.setAttribute('aria-expanded', 'false');
                        elements.dateFilterButton?.classList.remove('active');
                    }
                }
            });
        });
    }


    // Clear Filters Button
    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', () => {
            appState.selectedTypes = [];
            appState.selectedInstitutions = [];
            appState.selectedDateRange = '';
            appState.currentPage = 1;

            // Reset UI elements
            // Uncheck all checkboxes in type filter
            if (elements.typeFilterMenu) {
                const typeCheckboxes = elements.typeFilterMenu.querySelectorAll('input[type="checkbox"]');
                typeCheckboxes.forEach(cb => cb.checked = false);
            }
            // Uncheck all checkboxes in institution filter
            if (elements.institutionFilterMenu) {
                const instCheckboxes = elements.institutionFilterMenu.querySelectorAll('input[type="checkbox"]');
                instCheckboxes.forEach(cb => cb.checked = false);
            }
            // Reset date filter radio buttons
            if (elements.dateFilterRadios.length > 0) {
                elements.dateFilterRadios.forEach(radio => {
                    if (radio.value === '') {
                        radio.checked = true;
                        if (elements.dateFilterButton) {
                            elements.dateFilterButton.textContent = 'All Dates';
                        }
                    } else {
                        radio.checked = false;
                    }
                });
            }

            applyFiltersAndRender();
            updateUrlParams();
        });
    }
    // -------------------------------------
}

// --- Filter Logic ---

// Populate custom filter dropdown menus
function populateCustomFilters() {
    if (!appState.allRecords.length) return;

    const types = new Set();
    const institutions = new Set();

    appState.allRecords.forEach(record => {
        if (record.sourceResource?.type) {
            record.sourceResource.type.forEach(t => {
                if (t) types.add(t.trim());
            });
        }
        if (record.provider?.name) {
            institutions.add(record.provider.name.trim());
        }
    });

    const sortedTypes = Array.from(types).sort();
    const sortedInstitutions = Array.from(institutions).sort();

    // Populate Type Filter Menu
    if (elements.typeFilterMenu) {
        elements.typeFilterMenu.innerHTML = ''; // Clear existing items
        sortedTypes.forEach(type => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = type;
            // Check if this type is currently selected
            if (appState.selectedTypes.includes(type)) {
                checkbox.checked = true;
            }

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedTypes.includes(e.target.value)) {
                        appState.selectedTypes.push(e.target.value);
                    }
                } else {
                    appState.selectedTypes = appState.selectedTypes.filter(t => t !== e.target.value);
                }
                appState.currentPage = 1;
                applyFiltersAndRender();
                updateUrlParams();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${type}`));
            li.appendChild(label);
            elements.typeFilterMenu.appendChild(li);
        });
        // Update hidden select to mirror state if needed by other parts
        updateHiddenSelect(elements.typeFilterSelect, sortedTypes, appState.selectedTypes);
    }

    // Populate Institution Filter Menu
    if (elements.institutionFilterMenu) {
        elements.institutionFilterMenu.innerHTML = ''; // Clear existing items
        sortedInstitutions.forEach(inst => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = inst;
            // Check if this institution is currently selected
            if (appState.selectedInstitutions.includes(inst)) {
                checkbox.checked = true;
            }

            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedInstitutions.includes(e.target.value)) {
                        appState.selectedInstitutions.push(e.target.value);
                    }
                } else {
                    appState.selectedInstitutions = appState.selectedInstitutions.filter(i => i !== e.target.value);
                }
                appState.currentPage = 1;
                applyFiltersAndRender();
                updateUrlParams();
            });

            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${inst}`));
            li.appendChild(label);
            elements.institutionFilterMenu.appendChild(li);
        });
        // Update hidden select
        updateHiddenSelect(elements.institutionFilterSelect, sortedInstitutions, appState.selectedInstitutions);
    }

    // Date Filter Menu is pre-populated in HTML, no need to populate here.
    // But we need to set the correct radio button based on initial state
    if (appState.selectedDateRange && elements.dateFilterRadios.length > 0) {
        elements.dateFilterRadios.forEach(radio => {
            if (radio.value === appState.selectedDateRange) {
                radio.checked = true;
                // Update button text
                const selectedLabel = radio.parentElement.textContent.trim();
                if (elements.dateFilterButton) {
                    elements.dateFilterButton.textContent = selectedLabel;
                }
            }
        });
    }
    // Update hidden date select
    // Find the selected option text for the button
    if (elements.dateFilterSelect) {
        const selectedOption = Array.from(elements.dateFilterSelect.options).find(opt => opt.value === appState.selectedDateRange);
        if (selectedOption && elements.dateFilterButton) {
            elements.dateFilterButton.textContent = selectedOption.textContent;
        }
        elements.dateFilterSelect.value = appState.selectedDateRange;
    }
}

// Helper to update hidden select elements to reflect current selections
function updateHiddenSelect(selectElement, allOptions, selectedValues) {
    if (!selectElement) return;
    // Clear existing options
    selectElement.innerHTML = '';
    // Add all options
    allOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (selectedValues.includes(opt)) {
            option.selected = true;
        }
        selectElement.appendChild(option);
    });
}


// Apply search term and filters to get filteredRecords
function filterRecords() {
    let results = [...appState.allRecords];

    if (appState.searchTerm) {
        results = results.filter(record =>
            (record.sourceResource?.title?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.description?.[0]?.toLowerCase().includes(appState.searchTerm))
        );
    }

    // Apply Type filter (OR logic between selected types)
    if (appState.selectedTypes.length > 0) {
        results = results.filter(record => {
            const recordTypes = record.sourceResource?.type || [];
            return appState.selectedTypes.some(selectedType =>
                recordTypes.includes(selectedType)
            );
        });
    }

    // Apply Institution filter (OR logic between selected institutions)
    if (appState.selectedInstitutions.length > 0) {
        results = results.filter(record =>
            appState.selectedInstitutions.includes(record.provider?.name)
        );
    }

    // Apply Date Range filter (single select)
    if (appState.selectedDateRange && DATE_RANGES[appState.selectedDateRange]) {
        const range = DATE_RANGES[appState.selectedDateRange];
        results = results.filter(record => {
            const dateStr = record.sourceResource?.date?.[0];
            if (!dateStr) return false;

            const yearMatch = dateStr.match(/\d{4}/);
            if (!yearMatch) return false;

            const year = parseInt(yearMatch[0], 10);
            if (isNaN(year)) return false;

            const isAfterStart = range.start ? year >= range.start : true;
            const isBeforeEnd = range.end ? year <= range.end : true;
            return isAfterStart && isBeforeEnd;
        });
    }

    return results;
}

// Central function to apply filters and re-render
function applyFiltersAndRender() {
    appState.filteredRecords = filterRecords();
    renderCurrentView();
}
// ------------------


// --- URL Parameter Handling ---
function updateUrlParams() {
    const url = new URL(window.location);
    const params = url.searchParams;

    if (appState.selectedTypes.length > 0) {
        params.set('types', appState.selectedTypes.join(','));
    } else {
        params.delete('types');
    }

    if (appState.selectedInstitutions.length > 0) {
        params.set('institutions', appState.selectedInstitutions.join(','));
    } else {
        params.delete('institutions');
    }

    if (appState.selectedDateRange) {
        params.set('date', appState.selectedDateRange);
    } else {
        params.delete('date');
    }

    window.history.replaceState({}, '', url);
}

// TODO: Implement reading initial filter state from URL on page load
// function readUrlParams() { ... }
// ----------------------------


function filterAndRender() {
    applyFiltersAndRender();
}

// --- Initialization ---

async function initApp() {
    lucide.createIcons();

    setupEventListeners();

    elements.listViewBtn.classList.remove('active');
    elements.compactImageViewBtn.classList.remove('active');
    elements.tileViewBtn.classList.add('active');

    const fullDataset = await fetchFullDplaDataset();

    if (fullDataset && Array.isArray(fullDataset)) {
        appState.allRecords = fullDataset;
        populateCustomFilters(); // Populate custom dropdowns
        appState.filteredRecords = filterRecords();
        renderCurrentView();
        showElement(elements.contentArea);
        console.log("Application initialized successfully with demo data.");
    } else if (!appState.hasError && !appState.isLoading) {
         console.warn("Fetch did not return data and no error was set. This is unusual.");
         console.log("Falling back to local demo data generation.");
         appState.allRecords = generateDemoData(DEMO_RECORD_COUNT);
         populateCustomFilters(); // Populate after fallback
         appState.filteredRecords = filterRecords();
         renderCurrentView();
         showElement(elements.contentArea);
         saveFullDatasetToCache(appState.allRecords);
    }
}

// --- Demo Data Generator (MVP Placeholder) ---
function generateDemoData(count) {
    const types = ['image', 'text', 'physical object', 'moving image', 'sound', 'dataset'];
    const providers = [
        'Internet Archive', 'Smithsonian Institution', 'New York Public Library',
        'Library of Congress', 'British Museum', 'Metropolitan Museum of Art',
        'Getty Research Institute', 'Harvard University', 'Yale University',
        'University of California Libraries', 'Digital Public Library of America'
    ];
    const titles = [
        "The Great Pyramid of Giza", "Tutankhamun's Tomb", "Hieroglyphics Decoded",
        "Papyrus of Ani", "Temple of Karnak", "Valley of the Kings Map",
        "Egyptian Mummy Portrait", "Rosetta Stone Fragment", "Sphinx of Giza",
        "Ancient Egyptian Pottery", "Pharaoh Ramesses II Statue", "Nile River Flood Cycle",
        "Book of the Dead Scroll", "Canopic Jars", "Egyptian Chariot Model",
        "Obelisk of Heliopolis", "Temple of Abu Simbel", "Cartouche of Cleopatra",
        "Egyptian Solar Barque", "Mortuary Temple of Hatshepsut",
        "Tomb of Seti I", "Dendera Zodiac", "Colossi of Memnon", "Temple of Hatshepsut",
        "Egyptian Book of the Dead", "Amarna Period Artifacts", "Pyramid of Djoser",
        "Temple of Luxor", "Egyptian Sarcophagus", "Ancient Egyptian Jewelry"
    ];
    const descriptions = [
        "A detailed study of the construction techniques used in the Great Pyramid.",
        "Artifacts and findings from the discovery of Tutankhamun's intact tomb.",
        "Analysis of the decipherment of Egyptian hieroglyphs using the Rosetta Stone.",
        "Digital scan and translation of the Papyrus of Ani, part of the Book of the Dead.",
        "Architectural plans and historical context of the Temple of Karnak complex.",
        "Geological survey map of the Valley of the Kings excavation sites.",
        "Portrait of a young man, painted on wood, found in an Egyptian mummy wrappings.",
        "High-resolution image of a fragment of the stone bearing inscriptions in three scripts.",
        "Photograph of the limestone statue of the Great Sphinx, restored in recent years.",
        "Collection of pottery shards illustrating daily life in ancient Egyptian villages.",
        "Granite sculpture of the powerful pharaoh Ramesses II, now in the British Museum.",
        "Illustration depicting the annual flooding of the Nile and its impact on agriculture.",
        "Facsimile of a page from the Book of the Dead, showing spells for the afterlife.",
        "Set of four limestone canopic jars used to store mummified organs.",
        "Miniature wooden model of a chariot, found in the tomb of an Egyptian noble.",
        "Historical engraving of the tall obelisk originally erected in Heliopolis.",
        "Panoramic view of the rock-cut temples of Abu Simbel before relocation.",
        "Inscription of Cleopatra VII's royal cartouche found on a temple wall.",
        "Reconstruction of the mythical solar barque used by Ra in Egyptian mythology.",
        "Ruins of the mortuary temple built for Queen Hatshepsut at Deir el-Bahri.",
        "Excavation report and photographs from the tomb of Seti I in the Valley of the Kings.",
        "Detailed astronomical map of the zodiac ceiling from the Temple of Dendera.",
        "Photographs and drawings of the two massive stone statues of Pharaoh Amenhotep III.",
        "Architectural drawings and historical context of the mortuary temple of Hatshepsut.",
        "Digital facsimile and commentary on the Egyptian Book of the Dead papyri.",
        "Artifacts and analysis from the Amarna period, showcasing Akhenaten's religious reforms.",
        "Archaeological report on the Step Pyramid of Djoser, the world's oldest stone pyramid.",
        "Historical documentation and images of the Temple of Luxor and its obelisks.",
        "Detailed examination of an ancient Egyptian sarcophagus and its inscriptions.",
        "Catalog of ancient Egyptian jewelry, including pieces from royal tombs."
    ];

    const data = [];
    for (let i = 1; i <= count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];

        const hasImage = Math.random() > 0.2;
        const imageUrl = hasImage ? `https://picsum.photos/seed/egypt${i}/150/100` : null;

        const year = Math.floor(Math.random() * (2020 - 1000 + 1)) + 1000;
        const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;


        data.push({
            id: `demo-record-${i}`,
            sourceResource: {
                title: [title],
                description: [description],
                type: [type],
                date: [dateString]
            },
            provider: {
                name: provider
            },
            isShownAt: `https://example.com/record/${i}`,
            object: imageUrl
        });
    }
    return data;
}


// --- Start the App ---
document.addEventListener('DOMContentLoaded', initApp);