import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
import os

# Create 16:9 widescreen conference slide figure
fig = plt.figure(figsize=(16, 9), dpi=300)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Set background to pure white
fig.patch.set_facecolor('white')
ax.set_facecolor('white')

# 1. Add BITS Pilani Logo
if os.path.exists('conference_logo.png'):
    logo = Image.open('conference_logo.png')
    ax.imshow(logo, extent=[3.5, 12.5, 87.5, 97.5], aspect='auto', zorder=10)

# 2. Add Header Text
ax.text(14, 93, '8th International Conference on Communication and Intelligent Systems (ICCIS 2026)',
        fontsize=16, fontweight='bold', family='sans-serif', va='center', ha='left', color='#111111')

# 3. Add Slide Title: "Proposed Model"
ax.text(50, 83.5, 'Proposed Model', fontsize=26, fontweight='bold', family='serif',
        va='center', ha='center', color='black')

def draw_double_box(ax, x, y, w, h, text, fontsize=9.2, fontweight='bold'):
    # Outer rectangle
    outer = patches.Rectangle((x, y), w, h, linewidth=1.4, edgecolor='black', facecolor='white', zorder=3)
    ax.add_patch(outer)
    # Inner rectangle (double border effect matching reference image)
    inset_x = 0.35
    inset_y = 0.5
    inner = patches.Rectangle((x + inset_x, y + inset_y), w - 2*inset_x, h - 2*inset_y,
                              linewidth=0.8, edgecolor='black', facecolor='white', zorder=4)
    ax.add_patch(inner)
    # Text inside box
    ax.text(x + w/2, y + h/2, text, fontsize=fontsize, fontweight=fontweight, family='sans-serif',
            va='center', ha='center', color='black', zorder=5, multialignment='center')

# --- COORDINATES ---
col_w = 11.2
col_h = 7.5

# Top starter
top_x, top_y = 21.0, 71.5
draw_double_box(ax, top_x, top_y, col_w, col_h, 'CrisisSync\nCore', fontsize=10)

# Row 1 (Left to Right)
r1_y = 56.5
c1_x, c2_x, c3_x = 21.0, 35.5, 50.0

draw_double_box(ax, c1_x, r1_y, col_w, col_h, 'Capture Audio\nStream')
draw_double_box(ax, c2_x, r1_y, col_w, col_h, 'Speech-to-Text\n(VAD)')
draw_double_box(ax, c3_x, r1_y, col_w, col_h, 'Clinical Entity\nExtraction')

# Row 2 (Right to Left)
r2_y = 43.5
draw_double_box(ax, c1_x, r2_y, col_w, col_h, 'Dual Ensemble\nTriage (DNN+RF)')
draw_double_box(ax, c2_x, r2_y, col_w, col_h, 'Urgency / Risk\nScoring')
draw_double_box(ax, c3_x, r2_y, col_w, col_h, 'Biomedical\nFeature Vector')

# Row 3 (Decisions and Routing)
r3_y = 29.5
d1_x, d1_w = 17.6, 18.0
draw_double_box(ax, d1_x, r3_y, d1_w, col_h, 'Confidence > Threshold ?', fontsize=9.2)

m1_x, m1_w = 47.0, 12.0
draw_double_box(ax, m1_x, r3_y, m1_w, col_h, 'Severity Grade\n(S1 - S5)', fontsize=9.2)

m2_x, m2_w = 61.5, 12.0
draw_double_box(ax, m2_x, r3_y, m2_w, col_h, 'Spatial\nGeofencing', fontsize=9.2)

d2_x, d2_w = 76.0, 17.0
draw_double_box(ax, d2_x, r3_y, d2_w, col_h, 'Urgency > Threshold ?', fontsize=9.2)

# Row 4 (Bottom Row: Right to Left)
r4_y = 15.0
r4_w = 11.2
r4_h = 7.5

b6_x = d2_x + (d2_w - r4_w)/2  # centered directly under Decision 2 = 78.9
b5_x = b6_x - (r4_w + 2.2)      # 65.5
b4_x = b5_x - (r4_w + 2.2)      # 52.1
b3_x = b4_x - (r4_w + 2.2)      # 38.7
b2_x = b3_x - (r4_w + 2.2)      # 25.3
b1_x = b2_x - (r4_w + 2.2)      # 11.9

draw_double_box(ax, b6_x, r4_y, r4_w, r4_h, 'Active Incident\nFlagged', fontsize=8.5)
draw_double_box(ax, b5_x, r4_y, r4_w, r4_h, '100m Bystander\nBroadcast', fontsize=8.5)
draw_double_box(ax, b4_x, r4_y, r4_w, r4_h, 'OR-Tools Fleet\nAllocation', fontsize=8.5)
draw_double_box(ax, b3_x, r4_y, r4_w, r4_h, 'OSRM Road\nRouting & ETA', fontsize=8.5)
draw_double_box(ax, b2_x, r4_y, r4_w, r4_h, 'Emergency Unit\nDispatch', fontsize=8.5)
draw_double_box(ax, b1_x, r4_y, r4_w, r4_h, 'Mission Status\nResolved', fontsize=8.5)

# Horizontal baseline under row 4
ax.plot([6, 95], [13.5, 13.5], color='black', linewidth=1.5, zorder=2)

# Footer
ax.text(6.5, 7.5, 'CrisisSync AI: Autonomous Multi-Agent Emergency Triage & Dynamic Fleet Optimization',
        fontsize=8.5, family='sans-serif', color='#777777', va='center')
ax.text(94, 7.5, '18', fontsize=8.5, family='sans-serif', color='#777777', va='center', ha='right')

# --- ARROWS & CONNECTORS ---
arrow_props = dict(arrowstyle='->,head_width=0.35,head_length=0.6', color='black', lw=1.2)

def draw_arrow(ax, p1, p2):
    ax.annotate('', xy=p2, xytext=p1, arrowprops=arrow_props, zorder=6)

# 1. Top box down to Capture Audio Stream
top_mid_x = top_x + col_w / 2  # 26.6
ax.plot([top_mid_x, top_mid_x], [top_y, r1_y + col_h], color='black', lw=1.2, zorder=2)
draw_arrow(ax, (top_mid_x, r1_y + col_h + 0.6), (top_mid_x, r1_y + col_h))

# 2. Row 1 Left to Right:
draw_arrow(ax, (c1_x + col_w, r1_y + col_h/2), (c2_x, r1_y + col_h/2))
draw_arrow(ax, (c2_x + col_w, r1_y + col_h/2), (c3_x, r1_y + col_h/2))

# 3. Row 1 to Row 2: down arrow from Clinical Entity to Biomedical Feature Vector
c3_mid_x = c3_x + col_w / 2
draw_arrow(ax, (c3_mid_x, r1_y), (c3_mid_x, r2_y + col_h))

# 4. Row 2 Right to Left:
draw_arrow(ax, (c3_x, r2_y + col_h/2), (c2_x + col_w, r2_y + col_h/2))
draw_arrow(ax, (c2_x, r2_y + col_h/2), (c1_x + col_w, r2_y + col_h/2))

# 5. Row 2 to Row 3: down arrow from Dual Ensemble to Confidence > Threshold ?
c1_mid_x = c1_x + col_w / 2
draw_arrow(ax, (c1_mid_x, r2_y), (c1_mid_x, r3_y + col_h))

# 6. Row 3: Decision 1
# Branch 'Yes' -> to Severity Grade
draw_arrow(ax, (d1_x + d1_w, r3_y + col_h/2), (m1_x, r3_y + col_h/2))
ax.text(d1_x + d1_w + (m1_x - (d1_x + d1_w))/2, r3_y + col_h/2, 'Yes',
        fontsize=9.5, fontweight='bold', va='center', ha='center',
        bbox=dict(boxstyle='square,pad=0.2', facecolor='white', edgecolor='none'), zorder=7)

# Middle box 1 to Middle box 2:
draw_arrow(ax, (m1_x + m1_w, r3_y + col_h/2), (m2_x, r3_y + col_h/2))

# Middle box 2 to Decision 2:
draw_arrow(ax, (m2_x + m2_w, r3_y + col_h/2), (d2_x, r3_y + col_h/2))

# Branch 'No' from Decision 1: Loops left and up to Capture Audio Stream (Human Escalation Route)
ax.plot([d1_x, 11.5, 11.5], [r3_y + col_h/2, r3_y + col_h/2, r1_y + col_h/2], color='black', lw=1.2, zorder=2)
draw_arrow(ax, (11.5, r1_y + col_h/2), (c1_x, r1_y + col_h/2))
ax.text(11.5, 47.0, 'No\n(Human Escalation)', fontsize=8.5, fontweight='bold',
        va='center', ha='center', backgroundcolor='white', zorder=7, multialignment='center')

# 7. Row 3: Decision 2
d2_mid_x = d2_x + d2_w/2

# Branch 'Yes' -> goes straight down to Active Incident Flagged
draw_arrow(ax, (d2_mid_x, r3_y), (d2_mid_x, r4_y + r4_h))
ax.text(d2_mid_x, (r3_y + r4_y + r4_h)/2, 'Yes', fontsize=9.5, fontweight='bold',
        va='center', ha='center',
        bbox=dict(boxstyle='square,pad=0.2', facecolor='white', edgecolor='none'), zorder=7)

# Branch 'No' from Decision 2:
# Vertical line goes up with arrowhead and 'No'
ax.plot([d2_mid_x, d2_mid_x], [r3_y + col_h, 66.5], color='black', lw=1.2, zorder=2)
draw_arrow(ax, (d2_mid_x, 50.0), (d2_mid_x, 53.5))
ax.text(d2_mid_x, 55.5, 'No', fontsize=9.5, fontweight='bold', va='center', ha='center',
        backgroundcolor='white', zorder=7)
# Horizontal return line to meet the vertical drop line from CrisisSync Core
ax.plot([d2_mid_x, top_mid_x], [66.5, 66.5], color='black', lw=1.2, zorder=2)

# 8. Row 4 Right to Left:
draw_arrow(ax, (b6_x, r4_y + r4_h/2), (b5_x + r4_w, r4_y + r4_h/2))
draw_arrow(ax, (b5_x, r4_y + r4_h/2), (b4_x + r4_w, r4_y + r4_h/2))
draw_arrow(ax, (b4_x, r4_y + r4_h/2), (b3_x + r4_w, r4_y + r4_h/2))
draw_arrow(ax, (b3_x, r4_y + r4_h/2), (b2_x + r4_w, r4_y + r4_h/2))
draw_arrow(ax, (b2_x, r4_y + r4_h/2), (b1_x + r4_w, r4_y + r4_h/2))

# Save high-res PNG image
out_png = 'proposed_model_workflow.png'
plt.savefig(out_png, facecolor='white', edgecolor='none')
print(f"Generated {out_png}")
