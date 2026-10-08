"""Fictional customer profiles for the demo tenant.

Every company, person and address here is made up (websites and emails use the
reserved .example domain). See docs/product/synthetic-data-policy.md.
"""

from typing import TypedDict


class Profile(TypedDict):
    website: str
    hq_city: str
    hq_country: str
    company_size: str
    about: str
    industry_tags: list[str]
    contact_name: str
    contact_title: str
    contact_email: str


PROFILES: dict[str, Profile] = {
    "Lombarda Studio Group": {
        "website": "https://lombarda-studio.example",
        "hq_city": "Milan",
        "hq_country": "Italy",
        "company_size": "51-200",
        "about": "Design and architecture studio with three offices, moving staff and clients between sites every day.",
        "industry_tags": ["Architecture", "Interior design", "Client visits"],
        "contact_name": "Elena Marchetti",
        "contact_title": "Operations Director",
        "contact_email": "elena.marchetti@lombarda-studio.example",
    },
    "Cedar & Pine Logistics": {
        "website": "https://cedarpine.example",
        "hq_city": "Rotterdam",
        "hq_country": "Netherlands",
        "company_size": "201-1000",
        "about": "Last-mile parcel carrier serving dense city centres and running an electric pilot in two depots.",
        "industry_tags": ["Last-mile delivery", "Parcel", "Electrification"],
        "contact_name": "Joris van Dijk",
        "contact_title": "Head of Fleet",
        "contact_email": "joris.vandijk@cedarpine.example",
    },
    "Harbor Freight Cooperative": {
        "website": "https://harborfreight.example",
        "hq_city": "Genoa",
        "hq_country": "Italy",
        "company_size": "201-1000",
        "about": "Cooperative of port hauliers shuttling crews and containers between terminals around the clock.",
        "industry_tags": ["Port operations", "Haulage", "Shift work"],
        "contact_name": "Marco Bellini",
        "contact_title": "Transport Manager",
        "contact_email": "marco.bellini@harborfreight.example",
    },
    "Alder Health Network": {
        "website": "https://alderhealth.example",
        "hq_city": "Lyon",
        "hq_country": "France",
        "company_size": "1000+",
        "about": "Regional clinic network whose community nurses and clinicians travel between patients and sites.",
        "industry_tags": ["Healthcare", "Home care", "Community nursing"],
        "contact_name": "Camille Laurent",
        "contact_title": "Director of Staff Mobility",
        "contact_email": "camille.laurent@alderhealth.example",
    },
    "Brightwater Utilities": {
        "website": "https://brightwater-utilities.example",
        "hq_city": "Bristol",
        "hq_country": "United Kingdom",
        "company_size": "1000+",
        "about": "Water and wastewater utility with field crews covering a wide rural footprint.",
        "industry_tags": ["Utilities", "Field service", "Rural coverage"],
        "contact_name": "Priya Nair",
        "contact_title": "Fleet and Facilities Lead",
        "contact_email": "priya.nair@brightwater-utilities.example",
    },
    "Kestrel Biotech Campus": {
        "website": "https://kestrelbiotech.example",
        "hq_city": "Basel",
        "hq_country": "Switzerland",
        "company_size": "201-1000",
        "about": "Research campus of eleven biotech tenants that share shuttles, charging and visitor transport.",
        "industry_tags": ["Life sciences", "Campus mobility", "Sustainability"],
        "contact_name": "Lukas Meier",
        "contact_title": "Campus Operations Manager",
        "contact_email": "lukas.meier@kestrelbiotech.example",
    },
    "Meridian Law Partners": {
        "website": "https://meridianlaw.example",
        "hq_city": "Frankfurt",
        "hq_country": "Germany",
        "company_size": "51-200",
        "about": "Corporate law firm that provides pool cars for partners attending client sites and courts.",
        "industry_tags": ["Legal", "Executive travel"],
        "contact_name": "Sabine Keller",
        "contact_title": "Office Manager",
        "contact_email": "sabine.keller@meridianlaw.example",
    },
    "Solace Hospitality Group": {
        "website": "https://solacehotels.example",
        "hq_city": "Lisbon",
        "hq_country": "Portugal",
        "company_size": "201-1000",
        "about": "Boutique hotel group with airport transfers as part of its guest experience.",
        "industry_tags": ["Hospitality", "Airport transfers", "Guest experience"],
        "contact_name": "Inês Carvalho",
        "contact_title": "Guest Services Director",
        "contact_email": "ines.carvalho@solacehotels.example",
    },
    "Tidewater Insurance Services": {
        "website": "https://tidewaterins.example",
        "hq_city": "Dublin",
        "hq_country": "Ireland",
        "company_size": "201-1000",
        "about": "Claims-focused insurer whose adjusters visit properties and vehicles across the country.",
        "industry_tags": ["Insurance", "Claims", "Field adjusters"],
        "contact_name": "Aoife Brennan",
        "contact_title": "Claims Operations Lead",
        "contact_email": "aoife.brennan@tidewaterins.example",
    },
    "Skyline Aviation Services": {
        "website": "https://skyline-aviation.example",
        "hq_city": "Amsterdam",
        "hq_country": "Netherlands",
        "company_size": "201-1000",
        "about": "Ground-handling company moving crews between aprons, terminals and hotels at all hours.",
        "industry_tags": ["Aviation", "Ground handling", "Shift work"],
        "contact_name": "Daan Visser",
        "contact_title": "Ground Operations Manager",
        "contact_email": "daan.visser@skyline-aviation.example",
    },
    "Vantage Media Studios": {
        "website": "https://vantagemedia.example",
        "hq_city": "Barcelona",
        "hq_country": "Spain",
        "company_size": "51-200",
        "about": "Production studio moving crews and equipment to locations on short notice.",
        "industry_tags": ["Media", "Production", "Location shoots"],
        "contact_name": "Mateo Ruiz",
        "contact_title": "Head of Production",
        "contact_email": "mateo.ruiz@vantagemedia.example",
    },
    "Peregrine Outdoor Co": {
        "website": "https://peregrine-outdoor.example",
        "hq_city": "Innsbruck",
        "hq_country": "Austria",
        "company_size": "51-200",
        "about": "Outdoor-gear retailer running seasonal events and pop-up stores across the Alps.",
        "industry_tags": ["Retail", "Events", "Seasonal logistics"],
        "contact_name": "Katrin Hofer",
        "contact_title": "Events Coordinator",
        "contact_email": "katrin.hofer@peregrine-outdoor.example",
    },
    "Northgate University": {
        "website": "https://northgate-university.example",
        "hq_city": "Leeds",
        "hq_country": "United Kingdom",
        "company_size": "1000+",
        "about": "Large university piloting low-emission student and staff mobility across three campuses.",
        "industry_tags": ["Higher education", "Campus mobility", "Net zero"],
        "contact_name": "Dr Hannah Whitfield",
        "contact_title": "Sustainability Programme Lead",
        "contact_email": "hannah.whitfield@northgate-university.example",
    },
    "Orchard Retail Collective": {
        "website": "https://orchard-retail.example",
        "hq_city": "Turin",
        "hq_country": "Italy",
        "company_size": "201-1000",
        "about": "Regional grocery and home-delivery group renewing a mixed delivery fleet.",
        "industry_tags": ["Grocery", "Home delivery", "Fleet renewal"],
        "contact_name": "Giulia Rossi",
        "contact_title": "Head of Operations",
        "contact_email": "giulia.rossi@orchard-retail.example",
    },
    "Quarry & Co": {
        "website": "https://quarryandco.example",
        "hq_city": "Sheffield",
        "hq_country": "United Kingdom",
        "company_size": "51-200",
        "about": "Aggregates and construction supplier studying electrification of its depot vehicles.",
        "industry_tags": ["Construction", "Aggregates", "Depot electrification"],
        "contact_name": "Tom Hargreaves",
        "contact_title": "Depot Manager",
        "contact_email": "tom.hargreaves@quarryandco.example",
    },
    "Fernhill Council Services": {
        "website": "https://fernhill-council.example",
        "hq_city": "Fernhill",
        "hq_country": "United Kingdom",
        "company_size": "201-1000",
        "about": "Municipal services department managing a pool of vehicles shared by several teams.",
        "industry_tags": ["Public sector", "Municipal", "Shared fleet"],
        "contact_name": "Rachel Osei",
        "contact_title": "Fleet Coordinator",
        "contact_email": "rachel.osei@fernhill-council.example",
    },
}
