"""
Tenant Templates for Onboarding
Defines starter templates for different department sizes
"""

# Default Shifts
DEFAULT_SHIFTS = ["A", "B", "C"]

# Default Rank Structure (in order of hierarchy)
DEFAULT_RANKS = [
    "Fire Chief",
    "Deputy Chief", 
    "Battalion Chief",
    "Captain",
    "Lieutenant",
    "Engineer",
    "Firefighter",
    "Firefighter/Paramedic",
    "Firefighter/EMT"
]

# Default Apparatus Types
DEFAULT_APPARATUS_TYPES = [
    {"name": "Engine", "code": "E", "min_personnel": 3},
    {"name": "Medic", "code": "M", "min_personnel": 2},
    {"name": "Ladder", "code": "L", "min_personnel": 3},
    {"name": "Rescue", "code": "R", "min_personnel": 2},
    {"name": "Battalion Chief", "code": "BC", "min_personnel": 1},
    {"name": "Brush", "code": "BR", "min_personnel": 2},
    {"name": "Tanker", "code": "T", "min_personnel": 2},
]

# Template Definitions
TEMPLATES = {
    "blank": {
        "name": "Blank (Start from Scratch)",
        "description": "Empty tenant - configure everything yourself",
        "battalions": [],
        "stations": [],
        "apparatus": []
    },
    "small": {
        "name": "Small Department",
        "description": "1-5 stations, 1 battalion",
        "battalions": [
            {"number": "8100", "name": "Battalion 8100"}
        ],
        "stations": [
            {"number": "10", "name": "Station 10", "battalion": "8100", "min_staffing": 4},
            {"number": "11", "name": "Station 11", "battalion": "8100", "min_staffing": 4},
            {"number": "12", "name": "Station 12", "battalion": "8100", "min_staffing": 3},
        ],
        "apparatus": [
            {"station": "10", "name": "Engine 10", "type": "Engine"},
            {"station": "10", "name": "Medic 10", "type": "Medic"},
            {"station": "11", "name": "Engine 11", "type": "Engine"},
            {"station": "11", "name": "Medic 11", "type": "Medic"},
            {"station": "12", "name": "Engine 12", "type": "Engine"},
        ]
    },
    "medium": {
        "name": "Medium Department",
        "description": "6-15 stations, 2-3 battalions",
        "battalions": [
            {"number": "8100", "name": "Battalion 8100"},
            {"number": "8110", "name": "Battalion 8110"},
        ],
        "stations": [
            {"number": "10", "name": "Station 10", "battalion": "8100", "min_staffing": 5},
            {"number": "11", "name": "Station 11", "battalion": "8100", "min_staffing": 4},
            {"number": "12", "name": "Station 12", "battalion": "8100", "min_staffing": 4},
            {"number": "14", "name": "Station 14", "battalion": "8100", "min_staffing": 3},
            {"number": "20", "name": "Station 20", "battalion": "8110", "min_staffing": 5},
            {"number": "21", "name": "Station 21", "battalion": "8110", "min_staffing": 4},
            {"number": "22", "name": "Station 22", "battalion": "8110", "min_staffing": 4},
        ],
        "apparatus": [
            {"station": "10", "name": "Engine 10", "type": "Engine"},
            {"station": "10", "name": "Medic 10", "type": "Medic"},
            {"station": "10", "name": "Ladder 10", "type": "Ladder"},
            {"station": "11", "name": "Engine 11", "type": "Engine"},
            {"station": "11", "name": "Medic 11", "type": "Medic"},
            {"station": "12", "name": "Engine 12", "type": "Engine"},
            {"station": "12", "name": "Medic 12", "type": "Medic"},
            {"station": "14", "name": "Engine 14", "type": "Engine"},
            {"station": "20", "name": "Engine 20", "type": "Engine"},
            {"station": "20", "name": "Medic 20", "type": "Medic"},
            {"station": "20", "name": "Ladder 20", "type": "Ladder"},
            {"station": "21", "name": "Engine 21", "type": "Engine"},
            {"station": "21", "name": "Medic 21", "type": "Medic"},
            {"station": "22", "name": "Engine 22", "type": "Engine"},
        ]
    },
    "large": {
        "name": "Large Department",
        "description": "15+ stations, 3+ battalions",
        "battalions": [
            {"number": "8100", "name": "Battalion 8100"},
            {"number": "8110", "name": "Battalion 8110"},
            {"number": "8120", "name": "Battalion 8120"},
        ],
        "stations": [
            # Battalion 8100
            {"number": "10", "name": "Station 10", "battalion": "8100", "min_staffing": 5},
            {"number": "11", "name": "Station 11", "battalion": "8100", "min_staffing": 4},
            {"number": "12", "name": "Station 12", "battalion": "8100", "min_staffing": 4},
            {"number": "14", "name": "Station 14", "battalion": "8100", "min_staffing": 3},
            {"number": "15", "name": "Station 15", "battalion": "8100", "min_staffing": 4},
            # Battalion 8110
            {"number": "20", "name": "Station 20", "battalion": "8110", "min_staffing": 5},
            {"number": "21", "name": "Station 21", "battalion": "8110", "min_staffing": 4},
            {"number": "22", "name": "Station 22", "battalion": "8110", "min_staffing": 4},
            {"number": "23", "name": "Station 23", "battalion": "8110", "min_staffing": 3},
            {"number": "24", "name": "Station 24", "battalion": "8110", "min_staffing": 4},
            # Battalion 8120
            {"number": "40", "name": "Station 40", "battalion": "8120", "min_staffing": 5},
            {"number": "41", "name": "Station 41", "battalion": "8120", "min_staffing": 4},
            {"number": "42", "name": "Station 42", "battalion": "8120", "min_staffing": 4},
            {"number": "43", "name": "Station 43", "battalion": "8120", "min_staffing": 3},
            {"number": "60", "name": "Station 60", "battalion": "8120", "min_staffing": 4},
        ],
        "apparatus": [
            # Station 10
            {"station": "10", "name": "Engine 10", "type": "Engine"},
            {"station": "10", "name": "Medic 10", "type": "Medic"},
            {"station": "10", "name": "Ladder 10", "type": "Ladder"},
            # Station 11
            {"station": "11", "name": "Engine 11", "type": "Engine"},
            {"station": "11", "name": "Medic 11", "type": "Medic"},
            # Station 12
            {"station": "12", "name": "Engine 12", "type": "Engine"},
            {"station": "12", "name": "Medic 12", "type": "Medic"},
            # Station 14
            {"station": "14", "name": "Engine 14", "type": "Engine"},
            # Station 15
            {"station": "15", "name": "Engine 15", "type": "Engine"},
            {"station": "15", "name": "Medic 15", "type": "Medic"},
            # Station 20
            {"station": "20", "name": "Engine 20", "type": "Engine"},
            {"station": "20", "name": "Medic 20", "type": "Medic"},
            {"station": "20", "name": "Ladder 20", "type": "Ladder"},
            # Station 21
            {"station": "21", "name": "Engine 21", "type": "Engine"},
            {"station": "21", "name": "Medic 21", "type": "Medic"},
            # Station 22
            {"station": "22", "name": "Engine 22", "type": "Engine"},
            {"station": "22", "name": "Medic 22", "type": "Medic"},
            # Station 23
            {"station": "23", "name": "Engine 23", "type": "Engine"},
            # Station 24
            {"station": "24", "name": "Engine 24", "type": "Engine"},
            {"station": "24", "name": "Medic 24", "type": "Medic"},
            # Station 40
            {"station": "40", "name": "Engine 40", "type": "Engine"},
            {"station": "40", "name": "Medic 40", "type": "Medic"},
            {"station": "40", "name": "Rescue 40", "type": "Rescue"},
            # Station 41
            {"station": "41", "name": "Engine 41", "type": "Engine"},
            {"station": "41", "name": "Medic 41", "type": "Medic"},
            # Station 42
            {"station": "42", "name": "Engine 42", "type": "Engine"},
            {"station": "42", "name": "Medic 42", "type": "Medic"},
            # Station 43
            {"station": "43", "name": "Engine 43", "type": "Engine"},
            # Station 60
            {"station": "60", "name": "Engine 60", "type": "Engine"},
            {"station": "60", "name": "Medic 60", "type": "Medic"},
        ]
    }
}


def get_template(template_id: str) -> dict:
    """Get a template by ID"""
    return TEMPLATES.get(template_id, TEMPLATES["blank"])


def get_all_templates() -> list:
    """Get all available templates for selection"""
    return [
        {
            "id": key,
            "name": val["name"],
            "description": val["description"],
            "station_count": len(val["stations"]),
            "battalion_count": len(val["battalions"])
        }
        for key, val in TEMPLATES.items()
    ]
