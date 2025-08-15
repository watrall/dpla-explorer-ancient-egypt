const API_PROXY_URL = 'https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-db103013-6f04-45ed-9d08-869494cf2959/default/dpla-api-proxy';
const CACHE_DURATION_HOURS = 24;
const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEMO_RECORD_COUNT = 200;

const DATE_RANGES = {
    "before-1800": { start: null, end: 1799 },
    "1800-1900": { start: 1800, end: 1900 },
    "1900-1950": { start: 1900, end: 1950 },
    "1950-2000": { start: 1950, end: 2000 },
    "after-2000": { start: 2001, end: null }
};

let appState = {
    allRecords: [],
    filteredRecords: [],
    currentView: 'tile',
    currentPage: 1,
    itemsPerPage: DEFAULT_ITEMS_PER_PAGE,
    searchTerm: '',
    selectedTypes: [],
    selectedInstitutions: [],
    selectedDateRange: '',
    isLoading: false,
    hasError: false
};

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
    typeFilterButton: document.querySelector('#typeFilterContainer .dropdown-button'),
    typeFilterMenu: document.querySelector('#typeFilterContainer .dropdown-menu'),
    institutionFilterButton: document.querySelector('#institutionFilterContainer .dropdown-button'),
    institutionFilterMenu: document.querySelector('#institutionFilterContainer .dropdown-menu'),
    dateFilterButton: document.querySelector('#dateFilterContainer .dropdown-button'),
    dateFilterMenu: document.querySelector('#dateFilterContainer .dropdown-menu'),
    dateFilterRadios: document.querySelectorAll('input[name="dateFilterGroup"]'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn')
};

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

const FULL_DATASET_CACHE_KEY = 'dpla_egypt_full_dataset_demo_v4';

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
    } catch (e) {
        console.warn("Could not save full dataset to localStorage", e);
    }
}

function loadFullDatasetFromCache() {
    try {
        const cachedItemString = localStorage.getItem(FULL_DATASET_CACHE_KEY);
        if (!cachedItemString) {
            return null;
        }
        const cachedItem = JSON.parse(cachedItemString);
        if (isCacheValid(cachedItem) && Array.isArray(cachedItem.data)) {
            return cachedItem.data;
        } else {
            localStorage.removeItem(FULL_DATASET_CACHE_KEY);
            return null;
        }
    } catch (e) {
        console.warn("Could not load full dataset from localStorage", e);
        return null;
    }
}

async function fetchAllDplaRecords() {
    localStorage.removeItem('dpla_egypt_full_dataset_demo');
    localStorage.removeItem('dpla_egypt_full_dataset_demo_v2');
    localStorage.removeItem('dpla_egypt_full_dataset_demo_v3');
    
    let allRecords = loadFullDatasetFromCache();
    
    if (allRecords) {
        return allRecords;
    }
    
    setLoading(true);
    setError(false);
    
    try {
        const searchQuery = 'ancient egypt OR egyptian';
        
        const countUrl = new URL(API_PROXY_URL);
        countUrl.searchParams.set('endpoint', 'items');
        countUrl.searchParams.set('q', searchQuery);
        countUrl.searchParams.set('page_size', '0');
        
        const countResponse = await fetch(countUrl.toString());
        if (!countResponse.ok) {
            const errorText = await countResponse.text();
            throw new Error(`Failed to get record count: ${countResponse.status} - ${errorText}`);
        }
        
        const countData = await countResponse.json();
        const totalRecords = countData.count || 0;
        
        if (totalRecords === 0) {
            return [];
        }
        
        const batchSize = 100;
        const totalPages = Math.min(Math.ceil(totalRecords / batchSize), 10);
        let allDocs = [];
        
        for (let page = 1; page <= totalPages; page++) {
            const proxyUrl = new URL(API_PROXY_URL);
            proxyUrl.searchParams.set('endpoint', 'items');
            proxyUrl.searchParams.set('q', searchQuery);
            proxyUrl.searchParams.set('page_size', batchSize.toString());
            proxyUrl.searchParams.set('page', page.toString());
            
            const response = await fetch(proxyUrl.toString());
            if (!response.ok) {
                continue;
            }
            
            const data = await response.json();
            if (data && Array.isArray(data.docs)) {
                allDocs = allDocs.concat(data.docs);
            }
            
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        allRecords = allDocs;
        saveFullDatasetToCache(allRecords);
        return allRecords;
        
    } catch (error) {
        console.error("Error fetching full dataset:", error);
        setError(true);
        return [];
    } finally {
        setLoading(false);
    }
}

function renderListView(records) {
    const listElement = document.createElement('ul');
    listElement.className = 'list-view';

    records.forEach(record => {
        const itemElement = document.createElement('li');
        itemElement.className = 'list-item';

        const title = record.sourceResource?.title?.[0] || 'Untitled';
        const description = record.sourceResource?.description?.[0] || 'No description available.';
        const provider = record.provider?.name || 'Unknown Provider';
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';

        const truncatedDescription = description.length > 200 ? description.substring(0, 200) + '...' : description;

        itemElement.innerHTML = `
            <h3>${title}</h3>
            <p>${truncatedDescription}</p>
            <p class="provider">Provider: ${provider}</p>
            <a href="${linkUrl}" target="_blank" class="view-link">View Record on the DPLA</a>
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
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}" onerror="this.style.display='none'">`;
        } else {
            let iconName = 'file';
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'package';
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
                <a href="${linkUrl}" target="_blank" class="view-link">View Record on the DPLA</a>
            </div>
        `;
        gridElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(gridElement);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
        const linkUrl = record.id ? `https://dp.la/item/${record.id}` : '#';
        const imageUrl = record.object;
        const resourceType = record.sourceResource?.type?.[0]?.toLowerCase() || 'unknown';

        let imageHtml = '';
        if (imageUrl) {
            imageHtml = `<img src="${imageUrl}" alt="Thumbnail for ${title}" onerror="this.style.display='none'">`;
        } else {
            let iconName = 'file';
            if (resourceType.includes('image')) iconName = 'image';
            else if (resourceType.includes('text')) iconName = 'file-text';
            else if (resourceType.includes('physical')) iconName = 'package';
            else if (resourceType.includes('moving')) iconName = 'film';
            else if (resourceType.includes('sound')) iconName = 'music';
            else if (resourceType.includes('dataset')) iconName = 'database';

            imageHtml = `<i data-lucide="${iconName}" class="icon-placeholder"></i>`;
        }

        const truncatedDescription = description.length > 150 ? description.substring(0, 150) + '...' : description;

        itemElement.innerHTML = `
            <div class="civ-col-image">
                <div class="civ-image-container">
                    ${imageHtml}
                </div>
            </div>
            <div class="civ-col-title">${title}</div>
            <div class="civ-col-description">${truncatedDescription}</div>
            <div class="civ-col-date">${new Date().toLocaleDateString()}</div>
            <div class="civ-col-institution">${institution}</div>
            <div class="civ-col-link">
                <a href="${linkUrl}" target="_blank" aria-label="View Record on DPLA">
                    <i data-lucide="external-link"></i>
                </a>
            </div>
        `;
        listElement.appendChild(itemElement);
    });

    elements.contentArea.innerHTML = '';
    elements.contentArea.appendChild(listElement);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

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

    if (appState.currentView === 'list') {
        renderListView(recordsToShow);
    } else if (appState.currentView === 'tile') {
        renderTileView(recordsToShow);
    } else if (appState.currentView === 'compact-image') {
        renderCompactImageView(recordsToShow);
    }
    updatePaginationControls(appState.filteredRecords.length);
}

function toggleDropdown(button, menu) {
    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    
    document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(dropdown => {
        dropdown.classList.remove('show');
        const dropdownButton = dropdown.previousElementSibling;
        if (dropdownButton) {
            dropdownButton.setAttribute('aria-expanded', 'false');
            dropdownButton.classList.remove('active');
        }
    });
    
    if (!isExpanded) {
        menu.classList.add('show');
        button.setAttribute('aria-expanded', 'true');
        button.classList.add('active');
    } else {
        menu.classList.remove('show');
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('active');
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-dropdown')) {
        document.querySelectorAll('.custom-dropdown .dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
            const button = menu.previousElementSibling;
            if (button) {
                button.setAttribute('aria-expanded', 'false');
                button.classList.remove('active');
            }
        });
    }
});

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

    let searchTimeout;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            appState.searchTerm = e.target.value.toLowerCase();
            appState.currentPage = 1;
            filterAndRender();
        }, SEARCH_DEBOUNCE_MS);
    });

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

    if (elements.typeFilterButton && elements.typeFilterMenu) {
        elements.typeFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.typeFilterButton, elements.typeFilterMenu);
        });
    }

    if (elements.institutionFilterButton && elements.institutionFilterMenu) {
        elements.institutionFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.institutionFilterButton, elements.institutionFilterMenu);
        });
    }

    if (elements.dateFilterButton && elements.dateFilterMenu) {
        elements.dateFilterButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(elements.dateFilterButton, elements.dateFilterMenu);
        });
    }

    if (elements.dateFilterRadios.length > 0) {
        elements.dateFilterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    appState.selectedDateRange = e.target.value;
                    const selectedLabel = e.target.parentElement.textContent.trim();
                    if (elements.dateFilterButton) {
                        elements.dateFilterButton.textContent = selectedLabel || 'All Dates';
                    }
                    appState.currentPage = 1;
                    filterAndRender();
                    if (elements.dateFilterMenu) {
                        elements.dateFilterMenu.classList.remove('show');
                        elements.dateFilterButton?.setAttribute('aria-expanded', 'false');
                        elements.dateFilterButton?.classList.remove('active');
                    }
                }
            });
        });
    }

    if (elements.clearFiltersBtn) {
        elements.clearFiltersBtn.addEventListener('click', () => {
            appState.selectedTypes = [];
            appState.selectedInstitutions = [];
            appState.selectedDateRange = '';
            appState.searchTerm = '';
            appState.currentPage = 1;

            if (elements.typeFilterMenu) {
                const typeCheckboxes = elements.typeFilterMenu.querySelectorAll('input[type="checkbox"]');
                typeCheckboxes.forEach(cb => cb.checked = false);
            }
            
            if (elements.institutionFilterMenu) {
                const instCheckboxes = elements.institutionFilterMenu.querySelectorAll('input[type="checkbox"]');
                instCheckboxes.forEach(cb => cb.checked = false);
            }
            
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
            
            if (elements.searchInput) {
                elements.searchInput.value = '';
            }

            filterAndRender();
        });
    }
}

function populateFilters() {
    if (!appState.allRecords || !Array.isArray(appState.allRecords) || appState.allRecords.length === 0) return;

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

    if (elements.typeFilterMenu) {
        elements.typeFilterMenu.innerHTML = '';
        const sortedTypes = Array.from(types).sort();
        sortedTypes.forEach(type => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = type;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedTypes.includes(type)) {
                        appState.selectedTypes.push(type);
                    }
                } else {
                    appState.selectedTypes = appState.selectedTypes.filter(t => t !== type);
                }
                appState.currentPage = 1;
                filterAndRender();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(type));
            li.appendChild(label);
            elements.typeFilterMenu.appendChild(li);
        });
    }

    if (elements.institutionFilterMenu) {
        elements.institutionFilterMenu.innerHTML = '';
        const sortedInstitutions = Array.from(institutions).sort();
        sortedInstitutions.forEach(inst => {
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = inst;
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    if (!appState.selectedInstitutions.includes(inst)) {
                        appState.selectedInstitutions.push(inst);
                    }
                } else {
                    appState.selectedInstitutions = appState.selectedInstitutions.filter(i => i !== inst);
                }
                appState.currentPage = 1;
                filterAndRender();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(inst));
            li.appendChild(label);
            elements.institutionFilterMenu.appendChild(li);
        });
    }
}

function filterRecords() {
    let results = [...appState.allRecords];

    if (appState.searchTerm) {
        results = results.filter(record =>
            (record.sourceResource?.title?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.description?.[0]?.toLowerCase().includes(appState.searchTerm)) ||
            (record.sourceResource?.subject?.some(subject => subject.toLowerCase().includes(appState.searchTerm))) ||
            (record.sourceResource?.spatial?.some(spatial => spatial.toLowerCase().includes(appState.searchTerm)))
        );
    }

    if (appState.selectedTypes.length > 0) {
        results = results.filter(record => {
            const recordTypes = record.sourceResource?.type || [];
            return appState.selectedTypes.some(selectedType =>
                recordTypes.includes(selectedType)
            );
        });
    }

    if (appState.selectedInstitutions.length > 0) {
        results = results.filter(record =>
            appState.selectedInstitutions.includes(record.provider?.name)
        );
    }

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

function filterAndRender() {
    appState.filteredRecords = filterRecords();
    renderCurrentView();
}

async function initApp() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    setupEventListeners();

    elements.listViewBtn.classList.remove('active');
    elements.compactImageViewBtn.classList.remove('active');
    elements.tileViewBtn.classList.add('active');

    const fullDataset = await fetchAllDplaRecords();

    if (fullDataset && Array.isArray(fullDataset) && fullDataset.length > 0) {
        appState.allRecords = fullDataset;
        appState.filteredRecords = [...appState.allRecords];
        populateFilters();
        renderCurrentView();
        showElement(elements.contentArea);
    } else if (!appState.hasError && !appState.isLoading) {
        appState.allRecords = generateDemoData(DEMO_RECORD_COUNT);
        appState.filteredRecords = [...appState.allRecords];
        populateFilters();
        renderCurrentView();
        showElement(elements.contentArea);
        saveFullDatasetToCache(appState.allRecords);
    }
}

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
        "Egyptian Solar Barque", "Mortuary Temple of Hatshepsut"
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
        "Collection of pottery shards illustrating daily life in ancient Egyptian villages."
    ];

    const data = [];
    for (let i = 1; i <= count; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        const provider = providers[Math.floor(Math.random() * providers.length)];
        const title = titles[Math.floor(Math.random() * titles.length)];
        const description = descriptions[Math.floor(Math.random() * descriptions.length)];

        const hasImage = Math.random() > 0.2;
        const imageUrl = hasImage ? `https://picsum.photos/seed/egypt${i}/300/200` : null;

        data.push({
            id: `demo-record-${i}`,
            sourceResource: {
                title: [title],
                description: [description],
                type: [type]
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}