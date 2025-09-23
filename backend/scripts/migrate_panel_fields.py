import json
import psycopg2
from uuid import uuid4

def validate_shape(shape):
    """Validate panel shape and return 'rectangle' if invalid"""
    valid_shapes = ['rectangle', 'right-triangle', 'circle']
    return shape if shape in valid_shapes else 'rectangle'

def map_panel_to_canonical(panel):
    return {
        'id': panel.get('id') or panel.get('panel_id') or str(uuid4()),
        'date': panel.get('date', ''),
        'panelNumber': panel.get('panel_number') or panel.get('panelNumber', ''),
        'length': panel.get('length') or panel.get('height', 0),
        'width': panel.get('width', 0),
        'rollNumber': panel.get('roll_number') or panel.get('rollNumber', ''),
        'location': panel.get('location', ''),
        'x': panel.get('x', 0),
        'y': panel.get('y', 0),
        'shape': validate_shape(panel.get('shape') or panel.get('type', 'rectangle')),
        'points': panel.get('points'),
        'radius': panel.get('radius'),
        'rotation': panel.get('rotation', 0),
        'fill': panel.get('fill', '#3b82f6'),
        'color': panel.get('color') or panel.get('fill', '#3b82f6'),
    }

def migrate():
    conn = psycopg2.connect('postgresql://user:password@localhost:5432/yourdb')
    cur = conn.cursor()
    cur.execute('SELECT id, panels FROM panel_layouts')
    rows = cur.fetchall()
    for row in rows:
        layout_id, panels_json = row
        try:
            panels = json.loads(panels_json)
            canonical_panels = [map_panel_to_canonical(p) for p in panels]
            new_json = json.dumps(canonical_panels)
            cur.execute('UPDATE panel_layouts SET panels = %s WHERE id = %s', (new_json, layout_id))
            print(f'Migrated layout {layout_id}')
        except Exception as e:
            print(f'Error migrating layout {layout_id}: {e}')
    conn.commit()
    cur.close()
    conn.close()

if __name__ == '__main__':
    migrate()