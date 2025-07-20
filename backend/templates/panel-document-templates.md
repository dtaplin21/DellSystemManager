# Panel Document Templates for AI Layout Generation

This document provides templates for creating documents that the AI system can analyze to generate accurate panel layouts.

## Document Types and Templates

### 1. Panel Specifications Document

**Filename:** `panel-specifications.txt` or `panel-specs.pdf`

**Template:**
```
PANEL SPECIFICATIONS - PROJECT: [Project Name]

Panel P001:
- Roll Number: R001
- Dimensions: 40 ft x 100 ft
- Material: HDPE
- Thickness: 60 mils
- Location: Northwest corner
- Notes: Starting panel for grid layout

Panel P002:
- Roll Number: R002
- Dimensions: 40 ft x 100 ft
- Material: HDPE
- Thickness: 60 mils
- Location: Northeast corner
- Notes: Second panel in row 1

Panel P003:
- Roll Number: R003
- Dimensions: 40 ft x 100 ft
- Material: HDPE
- Thickness: 60 mils
- Location: Southwest corner
- Notes: First panel in row 2

[Continue for all panels...]
```

### 2. Roll Inventory Document

**Filename:** `roll-inventory.txt` or `material-rolls.pdf`

**Template:**
```
ROLL INVENTORY - PROJECT: [Project Name]

Roll R001:
- Material: HDPE
- Thickness: 60 mils
- Dimensions: 40 ft x 200 ft
- Available Area: 8,000 sq ft
- Location: Warehouse A
- Notes: Primary material for panels

Roll R002:
- Material: HDPE
- Thickness: 60 mils
- Dimensions: 40 ft x 200 ft
- Available Area: 8,000 sq ft
- Location: Warehouse A
- Notes: Secondary material

[Continue for all rolls...]
```

### 3. Site Plan Document

**Filename:** `site-plan.txt` or `site-drawing.pdf`

**Template:**
```
SITE PLAN - PROJECT: [Project Name]

Site Dimensions:
- Width: 1,000 feet
- Length: 800 feet
- Total Area: 800,000 sq ft

Obstacles:
1. Building A: Located at coordinates (200, 300), Dimensions: 50 ft x 30 ft
2. Utility Pole: Located at coordinates (500, 400), Type: Electrical
3. Tree Cluster: Located at coordinates (700, 200), Dimensions: 20 ft x 15 ft

Access Paths:
1. Main Entrance: From (0, 0) to (100, 0), Width: 20 ft
2. Service Road: From (0, 400) to (1000, 400), Width: 15 ft

Terrain Type: Flat
Installation Constraints:
- Minimum 6-inch overlap on all seams
- Anchor panels at 10-foot intervals on perimeter
- Maintain 5-foot clearance from all obstacles
```

### 4. Material Specifications Document

**Filename:** `material-specifications.txt` or `material-specs.pdf`

**Template:**
```
MATERIAL SPECIFICATIONS - PROJECT: [Project Name]

Primary Material:
- Type: HDPE (High-Density Polyethylene)
- Thickness: 60 mils
- Grade: Standard
- Color: Black

Seam Requirements:
- Type: Fusion welding
- Overlap: 6 inches minimum
- Temperature: 450°F
- Pressure: 40 psi

Quality Standards:
- ASTM D4437 (Standard Specification for Polyethylene and Ethylene Copolymer Plastic Geomembranes)
- ASTM D6392 (Standard Test Method for Determining the Integrity of Nonreinforced Geomembrane Seams Produced Using Thermo-Fusion Methods)

Testing Requirements:
- Seam peel test
- Tensile strength test
- Puncture resistance test
- Thickness verification
```

### 5. Installation Notes Document

**Filename:** `installation-notes.txt` or `install-procedure.pdf`

**Template:**
```
INSTALLATION NOTES - PROJECT: [Project Name]

Overlap Requirements:
- Minimum 6-inch overlap on all panel seams
- Overlap direction: North to South, East to West
- Seam orientation: Parallel to site boundaries

Anchoring Requirements:
- Anchor panels at 10-foot intervals on perimeter
- Use 12-inch anchor trench
- Backfill with compacted soil

Drainage Considerations:
- Maintain 2% slope for drainage
- Install drainage layer beneath panels
- Ensure proper drainage outlet locations

Installation Sequence:
1. Start with Panel P001 at Northwest corner
2. Install panels in rows from West to East
3. Maintain proper overlap and alignment
4. Anchor perimeter panels immediately after placement

Quality Control:
- Verify panel dimensions before installation
- Check seam quality after welding
- Document all installation activities
```

## How to Use These Templates

1. **Create Documents**: Use these templates to create documents with your specific project information
2. **Upload to System**: Upload the documents through the AI assistant interface
3. **Generate Layout**: Use the "Generate AI Layout" feature to create panel layouts based on your documents
4. **Review and Adjust**: Review the generated layout and make any necessary adjustments

## Document Naming Conventions

For best results, use these naming conventions:
- `panel-specs-[project-name].txt`
- `roll-inventory-[project-name].txt`
- `site-plan-[project-name].txt`
- `material-specs-[project-name].txt`
- `install-notes-[project-name].txt`

## Required Information

**Minimum Required for Panel Generation:**
- Panel specifications (panel numbers, dimensions, roll numbers)
- Site dimensions
- Material specifications

**Optional but Recommended:**
- Roll inventory
- Site obstacles and constraints
- Installation requirements
- Quality control specifications

## Example Complete Document Set

For a simple project, you might create:

1. **panel-specs.txt** - List all required panels with dimensions
2. **site-plan.txt** - Site dimensions and basic constraints
3. **material-specs.txt** - Material type and seam requirements

This minimum set will allow the AI to generate a functional panel layout. 