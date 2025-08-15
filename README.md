# DPLA Explorer: Ancient Egypt

Explore Ancient Egypt through the vast collections of the Digital Public Library of America (DPLA). This web application provides access to thousands of images, texts, videos, and sounds related to ancient Egyptian civilization from libraries, archives, and museums across the United States.

## Features

### Comprehensive Search
- Searches across multiple metadata fields including titles, descriptions, subjects, and geographic locations
- Uses controlled vocabularies from LCSH, TGN, and AAT for precise results
- Finds content related to ancient Egypt beyond simple keyword matching

### Multiple Views
- **Tile View** (Default): Visual grid layout with thumbnails for quick browsing
- **List View**: Traditional list format with detailed information
- **Compact Image View**: Data-rich table view with images and metadata

### Advanced Filtering
- **Content Type Filter**: Narrow results by format (images, texts, videos, etc.)
- **Institution Filter**: Filter by contributing organizations
- **Date Range Filter**: Focus on specific time periods
- **Search Within Results**: Dynamic filtering of displayed content

### User-Friendly Interface
- Responsive design works on desktop and mobile devices
- Pagination controls for navigating large result sets
- "Clear Filters" button to reset all filters
- Direct links to original records on DPLA and contributing institutions

### Technical Highlights
- Fetches all available ancient Egypt related records from DPLA API
- Implements serverless function proxy for secure API access
- Caches results for improved performance
- Uses Lucide icons for consistent visual elements

## How It Works

The application queries the DPLA API using a comprehensive set of search terms related to ancient Egypt, including:
- Library of Congress Subject Headings (LCSH)
- Getty Thesaurus of Geographic Names (TGN) 
- Art & Architecture Thesaurus (AAT) terms
- Historical period names and Egyptian geographic locations
- Common keywords and phrases

All API interactions are handled through a DigitalOcean serverless function proxy to protect API credentials while enabling client-side access.

## About DPLA

The Digital Public Library of America (DPLA) aggregates metadata from libraries, archives, and museums across the United States, making it freely available through a single platform. This application focuses specifically on content related to ancient Egyptian civilization.
