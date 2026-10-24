import os
import json
import hashlib
from PIL import Image, ImageOps

thumbs_dir = os.path.join('public', 'images', 'thumbs')
opt_dir = os.path.join('public', 'images', 'optimized')
os.makedirs(thumbs_dir, exist_ok=True)
os.makedirs(opt_dir, exist_ok=True)

# Load watermark image
wm_path = os.path.join('public', 'watermark.png')
if os.path.exists(wm_path):
    watermark_img = Image.open(wm_path).convert('RGBA')
else:
    watermark_img = None

def apply_watermark(image_rgb, size_ratio=0.22, opacity=0.75):
    if watermark_img is None:
        return image_rgb
    
    img_rgba = image_rgb.convert('RGBA')
    w, h = img_rgba.size
    
    wm_dim = max(90, int(min(w, h) * size_ratio))
    wm_res = watermark_img.resize((wm_dim, wm_dim), Image.LANCZOS)
    
    # Adjust opacity
    r, g, b, a = wm_res.split()
    a = a.point(lambda p: int(p * opacity))
    wm_res.putalpha(a)
    
    margin = max(12, int(min(w, h) * 0.035))
    pos = (w - wm_dim - margin, h - wm_dim - margin)
    
    watermarked = img_rgba.copy()
    watermarked.paste(wm_res, pos, wm_res)
    return watermarked.convert('RGB')

# Load OCR results
with open('images_ocr.json', 'r', encoding='utf-8-sig') as f:
    ocr_data = {item['Name']: item['Text'] for item in json.load(f)}

# Known exact duplicates or requested exclusions to skip
skip_files = {
    'DSC05907 (1).jpg', # duplicate of DSC05907.jpg
    'WhatsApp Image 2024-12-23 at 9.30.22 PM.jpeg', # duplicate of WhatsApp Image 2024-12-21 at 12.17.29 PM.jpeg
    'DSC09743.jpg', # Excluded by user request (7Span stall)
    'WhatsApp Image 2024-12-21 at 12.17.19 PM.jpeg', # Excluded by user request (unfinished raw plywood stall)
    'WhatsApp Image 2024-12-21 at 12.17.14 PM.jpeg', # Excluded by user request (auditorium/conference hall seating)
    'DSC06278.jpg', # Excluded by user request (outdoor crowd/parking lot photo)
}

# Mapping of file patterns or names to verified project groupings and details
def classify_image(filename, ocr_text):
    fname = filename.lower()
    txt = ocr_text.lower()
    
    # 1. Radix 3D Designs
    if 'radix' in fname:
        view_num = fname.replace('.jpg', '').replace('radix_view_', '')
        spec_text = "Technical spatial layout and 3D architectural render with specified profile lighting, AV mount points, and custom branded fascia."
        if 'profile light' in txt:
            spec_text = "Technical production elevation plan: 55\" & 42\" LED AV monitors, seamless paint finish, and profile illumination specifications."
        return {
            'projectId': 'radix-threat-defense',
            'projectTitle': 'Radix Threat Defense & Cloud Security',
            'client': 'Radix Software Development',
            'category': '3d-concepts',
            'categoryLabel': '3D Concepts & Renders',
            'event': 'Cybersecurity & Cloud Summit',
            'location': 'Ahmedabad / International Expo',
            'year': '2024',
            'boothNumber': 'Island Pavilion',
            'specs': 'Modular Aluminum & MDF Structure, 55" LED Displays, Warm Profile Lighting',
            'description': 'Comprehensive 3D spatial concept and detailed fabrication elevations for Radix. Featuring a multi-angle demo station, autonomous platform signage, and integrated client consultation lounge.',
            'caption': f'Radix Exhibition Stall — 3D Render & Elevation View {view_num}',
            'tags': ['3D Visualization', 'Elevation Plan', 'Tech Stall', 'Custom Lighting', 'AV Integration'],
            'isLead': fname == 'radix_view_1.jpg'
        }

    # 2. Techify 3D Designs
    if 'techify' in fname:
        view_num = fname.replace('.jpg', '').replace('techify_view_', '')
        return {
            'projectId': 'techify-solutions-s6',
            'projectTitle': 'Techify Solutions Exhibition Stall',
            'client': 'Techify Solutions',
            'category': '3d-concepts',
            'categoryLabel': '3D Concepts & Renders',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth S6',
            'specs': '4x6 Backlit Posters, Border LED Strip Lighting, Discussion Counter & Round Tables',
            'description': 'Detailed 3D booth concept and structural layout for Techify Solutions at Booth S6, incorporating high-impact backlit graphics, QR lead capture stations, and dedicated consultation zones.',
            'caption': f'Techify Solutions — 3D Spatial Layout & Render {view_num}',
            'tags': ['3D Concept', 'Backlit Graphics', 'Modular Stand', 'Booth S6'],
            'isLead': fname == 'techify_view_1.jpg'
        }

    # 3. International - Benefex London
    if 'benefex' in fname:
        return {
            'projectId': 'benefex-excel-london',
            'projectTitle': 'Benefex Global Employee Benefits Pavilion',
            'client': 'Benefex',
            'category': 'international',
            'categoryLabel': 'International Exhibitions',
            'event': 'Employee Benefits Live',
            'location': 'ExCeL London, United Kingdom',
            'year': '2024',
            'boothNumber': 'Main Hall Booth',
            'specs': 'Bespoke Architectural Pavilion, Overhead Signage Rig, Brand Activation Lounge',
            'description': 'Premium large-scale exhibition booth constructed for Benefex at ExCeL London, featuring bold architectural canopying, bespoke presentation pods, and flawless brand identity execution.',
            'caption': 'Benefex Exhibition Stand at ExCeL London',
            'tags': ['International', 'ExCeL London', 'Bespoke Pavilion', 'Corporate Exhibition'],
            'isLead': True
        }

    # 4. International - Chambury Birmingham
    if 'chambury' in fname:
        return {
            'projectId': 'chambury-nec-birmingham',
            'projectTitle': 'Chambury Learning Solutions Pavilion',
            'client': 'Chambury Learning Solutions',
            'category': 'international',
            'categoryLabel': 'International Exhibitions',
            'event': 'World of Learning Conference & Exhibition',
            'location': 'NEC Birmingham, United Kingdom',
            'year': '2024',
            'boothNumber': 'Hall 3',
            'specs': 'Custom Curved Timber Finish, Integrated Digital Demos, Private Meeting Enclosure',
            'description': 'Bespoke timber-crafted exhibition stall executed for Chambury Learning Solutions at the National Exhibition Centre (NEC) Birmingham.',
            'caption': 'Chambury Learning Stand at NEC Birmingham',
            'tags': ['International', 'NEC Birmingham', 'Custom Joinery', 'Education Tech'],
            'isLead': True
        }

    # 5. AppAspect Technologies
    if 'appaspect' in txt or fname in ['dsc05907.jpg', 'whatsapp image 2024-12-21 at 12.17.28 pm.jpeg']:
        return {
            'projectId': 'appaspect-tech-expo',
            'projectTitle': 'AppAspect Technologies Exhibition Stall',
            'client': 'AppAspect Technologies',
            'category': 'custom-stalls',
            'categoryLabel': 'Custom Exhibition Stalls',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Corner Stand',
            'specs': 'Custom Corner Arch, Backlit Logo Fascia, Showcase Counters, LED Downlighters',
            'description': 'Prominent open corner stall fabrication for AppAspect Technologies showcasing mobile app ecosystems and digital transformation platforms with seamless finished surfaces and high-lux illumination.',
            'caption': 'AppAspect Technologies — Corner Stall View',
            'tags': ['Custom Stall', 'Corner Booth', 'Backlit Fascia', 'Tech Expo', 'Fabrication'],
            'isLead': fname == 'dsc05907.jpg'
        }

    # 6. Syndell Technologies
    if 'syndell' in txt or fname in ['dsc06215.jpg', 'dsc06224.jpg']:
        return {
            'projectId': 'syndell-tech-expo',
            'projectTitle': 'Syndell Technologies Exhibition Stall',
            'client': 'Syndell Technologies',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Main Corridor Stand',
            'specs': 'Custom Matte Black & Neon Yellow Highlights, 3D Typography, Reception Pod',
            'description': 'High-contrast modern corporate stall fabricated for Syndell Technologies, featuring clean geometric lines, raised flooring, and targeted LED task lighting for product demonstrations.',
            'caption': 'Syndell Technologies — Enterprise Booth View',
            'tags': ['Tech Stall', 'Custom Fabrication', 'Corporate Booth', 'Raised Flooring'],
            'isLead': fname == 'dsc06215.jpg'
        }

    # 7. MagnusMinds
    if 'magnus' in txt or fname in ['dsc05911.jpg', 'whatsapp image 2024-12-21 at 12.17.27 pm (2).jpeg']:
        return {
            'projectId': 'magnusminds-tech-expo',
            'projectTitle': 'MagnusMinds Solutions Exhibition Stall',
            'client': 'MagnusMinds Solutions',
            'category': 'custom-stalls',
            'categoryLabel': 'Custom Exhibition Stalls',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth E7',
            'specs': 'Dual-Sided Branding Arch, Acrylic 3D Emblems, Consultation Counters',
            'description': 'Spacious and welcoming booth environment engineered for MagnusMinds, optimized for high visitor throughput and executive client engagements.',
            'caption': 'MagnusMinds Solutions — Exhibition Stand',
            'tags': ['Custom Booth', 'Branded Arch', 'Tech Expo', 'Fabrication'],
            'isLead': fname == 'dsc05911.jpg'
        }

    # 8. IQ Infinite Technologies
    if 'infinite' in txt or fname in ['dsc05925.jpg', 'whatsapp image 2024-12-21 at 12.17.15 pm (2).jpeg']:
        return {
            'projectId': 'iq-infinite-tech-expo',
            'projectTitle': 'IQ Infinite Technologies Exhibition Stall',
            'client': 'IQ Infinite Technologies',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth E59',
            'specs': 'Clean Monochromatic Theme, Direct Graphics Printing, AV Display Panel',
            'description': 'Modern minimalist exhibition stall designed and fabricated for IQ Infinite Technologies at Booth E59.',
            'caption': 'IQ Infinite Technologies — Booth E59',
            'tags': ['Booth E59', 'Minimalist Stand', 'Corporate Tech'],
            'isLead': fname == 'dsc05925.jpg'
        }

    # 9. Infynno Solutions
    if 'infynno' in txt or fname in ['dsc05914.jpg', 'whatsapp image 2024-12-21 at 12.17.29 pm (1).jpeg']:
        return {
            'projectId': 'infynno-solutions-tech-expo',
            'projectTitle': 'Infynno Solutions Exhibition Stall',
            'client': 'Infynno Solutions',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Tech Zone',
            'specs': 'Vibrant Accent Paneling, Dedicated Demo Console, High-Resolution Fabric Graphics',
            'description': 'Eye-catching branded exhibition stall built for Infynno Solutions highlighting fintech and digital platforms.',
            'caption': 'Infynno Solutions — Exhibition Booth',
            'tags': ['Fintech Booth', 'Graphic Walls', 'Custom Woodwork'],
            'isLead': fname == 'dsc05914.jpg'
        }

    # 10. UXTeam Studio
    if 'uxteam' in txt or fname in ['dsc06268.jpg', 'whatsapp image 2024-12-21 at 12.17.22 pm (1).jpeg']:
        return {
            'projectId': 'uxteam-tech-expo',
            'projectTitle': 'UXTeam Experience & Design Stall',
            'client': 'UXTeam',
            'category': 'custom-stalls',
            'categoryLabel': 'Custom Exhibition Stalls',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Design Pavilion',
            'specs': 'Warm Architectural Finish, Curated Case Study Walls, Designer Seating',
            'description': 'Sophisticated creative studio booth crafted for UXTeam, reflecting architectural elegance with balanced negative space and tailored portfolio presentation walls.',
            'caption': 'UXTeam — Design Studio Exhibition Space',
            'tags': ['Design Studio', 'Architectural Stall', 'Bespoke Detailing'],
            'isLead': fname == 'dsc06268.jpg'
        }

    # 10.5 Razorpay Global FinTech
    if 'razorpay' in txt or fname in ['dsc09735.jpg', 'dsc09736.jpg', 'dsc09732.jpg', 'whatsapp image 2024-12-21 at 12.17.13 pm (1).jpeg']:
        return {
            'projectId': 'razorpay-tech-expo',
            'projectTitle': 'Razorpay Global FinTech & International Payments Pavilion',
            'client': 'Razorpay',
            'category': 'pavilions',
            'categoryLabel': 'Brand Pavilions & Activations',
            'event': 'Gujarat Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'FinTech Pavilion',
            'specs': 'Bespoke Architectural Pavilion, Digital Payment Demo Bar, High-Illumination Fascia',
            'description': 'Premier exhibition pavilion executed for Razorpay showcasing their global payments suite and enterprise fintech solutions. Features custom overhead branding, live interactive checkout demo stations, and dedicated B2B discussion lounges.',
            'caption': 'Razorpay — Global Payments Suite Pavilion',
            'tags': ['FinTech', 'Razorpay', 'Flagship Pavilion', 'Enterprise Payments'],
            'isLead': fname == 'dsc09735.jpg'
        }

    # 11. factoHR
    if 'factohr' in txt or fname in ['dsc09711.jpg', 'dsc09712.jpg', 'whatsapp image 2024-12-21 at 12.17.13 pm.jpeg']:
        return {
            'projectId': 'factohr-tech-expo',
            'projectTitle': 'factoHR Enterprise Human Resource Stall',
            'client': 'factoHR',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Hall A Executive Stand',
            'specs': 'Gloss Acrylic Branding, Dual Discussion Zones, Illuminated Product Pillars',
            'description': 'Premium corporate exhibition stand executed for factoHR, featuring multi-tiered product displays, G2 award showcases, and high-impact branded headers.',
            'caption': 'factoHR — Enterprise Showcase Stall',
            'tags': ['Enterprise Software', 'High Gloss Finish', 'Executive Stand'],
            'isLead': fname == 'dsc09712.jpg'
        }

    # 12. JigNect Technologies
    if 'jignect' in txt or fname in ['dsc09722.jpg', 'whatsapp image 2024-12-21 at 12.17.20 pm (1).jpeg']:
        return {
            'projectId': 'jignect-tech-expo',
            'projectTitle': 'JigNect Technologies Software Quality Stall',
            'client': 'JigNect Technologies',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth E-44',
            'specs': 'Custom Geometric Fascia, LED Accent Coves, Interactive QA Station',
            'description': 'Sharp and well-lit exhibition presence built for JigNect Technologies at Booth E-44.',
            'caption': 'JigNect Technologies — Booth E-44',
            'tags': ['Booth E-44', 'Software Testing', 'Custom Lighting'],
            'isLead': fname == 'dsc09722.jpg'
        }

    # 13. Technobrains
    if 'technobrains' in txt or fname in ['dsc09686.jpg', 'dsc09687.jpg']:
        return {
            'projectId': 'technobrains-tech-expo',
            'projectTitle': 'Technobrains Expo Organiser Pavilion',
            'client': 'Technobrains / Elsner Group',
            'category': 'pavilions',
            'categoryLabel': 'Brand Pavilions & Activations',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Organiser Pavilion',
            'specs': 'Expansive Frontage, Multi-Screen Video Wall Mount, VIP Reception Desk',
            'description': 'Prestigious flagship pavilion fabricated for the official organisers and key stakeholders at Tech Expo 2024.',
            'caption': 'Technobrains — Flagship Organiser Pavilion',
            'tags': ['Flagship Pavilion', 'Multi-Screen AV', 'VIP Lounge', 'Tech Expo'],
            'isLead': fname == 'dsc09686.jpg'
        }

    # 14. Theta Technolabs & CirrOps
    if 'theta' in txt or 'cirr0ps' in txt or fname in ['dsc06684.jpg', 'dsc09723.jpg', 'whatsapp image 2024-12-21 at 12.17.21 pm.jpeg', 'whatsapp image 2024-12-21 at 12.17.21 pm (1).jpeg']:
        return {
            'projectId': 'theta-cirrops-tech-expo',
            'projectTitle': 'Theta Technolabs & CirrOps Cloud Stall',
            'client': 'Theta Technolabs / CirrOps',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth E-42 & E-43',
            'specs': 'Seamless Partitioning, Cloud Architecture Diagram Displays, Front Counter',
            'description': 'Engineered double-width exhibition stall for Theta Technolabs and CirrOps Cloud Solutions.',
            'caption': 'Theta & CirrOps — Cloud & Engineering Booth',
            'tags': ['Cloud Tech', 'Double Booth', 'Modular Walls'],
            'isLead': fname == 'dsc06684.jpg'
        }

    # 15. Saeculum Solutions
    if 'saeculum' in txt or fname in ['dsc06236.jpg', 'whatsapp image 2024-12-21 at 12.17.29 pm (2).jpeg']:
        return {
            'projectId': 'saeculum-tech-expo',
            'projectTitle': 'Saeculum Solutions Exhibition Stand',
            'client': 'Saeculum Solutions',
            'category': 'custom-stalls',
            'categoryLabel': 'Custom Exhibition Stalls',
            'event': 'Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Corporate Corridor',
            'specs': 'Bold Header Canopy, Custom Woodwork Pods, Warm Ambient Downlighting',
            'description': 'Turnkey exhibition stall constructed for Saeculum Solutions.',
            'caption': 'Saeculum Solutions — Exhibition Stand',
            'tags': ['Corporate Stand', 'Canopy Header', 'Turnkey Fabrication'],
            'isLead': fname == 'dsc06236.jpg'
        }

    # 16. Shine India & Binary Logistics (Industrial)
    if 'shine india' in txt or 'binary' in txt or 'veetroboe' in txt:
        return {
            'projectId': 'industrial-manufacturing-expo',
            'projectTitle': 'Industrial Machinery & Fleet Logistics Stalls',
            'client': 'Shine India & Binary Logistics',
            'category': 'custom-stalls',
            'categoryLabel': 'Custom Exhibition Stalls',
            'event': 'Industrial & Manufacturing Expo',
            'location': 'Gujarat, India',
            'year': '2024',
            'boothNumber': 'Heavy Engineering Bay',
            'specs': 'Reinforced Heavy-Load Platform, Equipment Display Clearance, High-Lux Floodlighting',
            'description': 'Specialized industrial stall fabrication engineered for heavy equipment demonstrations, machinery displays, and logistics tech.',
            'caption': 'Industrial & Manufacturing Equipment Stall',
            'tags': ['Industrial Expo', 'Heavy Machinery', 'Reinforced Platform'],
            'isLead': fname == 'whatsapp image 2024-11-11 at 5.01.55 pm.jpeg'
        }

    # 17. Technostacks
    if 'technostacks' in txt or 'e26' in txt or fname == 'dsc05940.jpg':
        return {
            'projectId': 'technostacks-tech-expo',
            'projectTitle': 'Technostacks Immersive Solutions Stall',
            'client': 'Technostacks',
            'category': 'tech-corporate',
            'categoryLabel': 'Tech & Corporate Expo',
            'event': 'Gujarat Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Booth E26',
            'specs': 'Immersive Tech Display Booth, Digital Touch Demos, Overhead Suspended Banner',
            'description': 'Modern tech exhibition stand fabricated for Technostacks at Booth E26, featuring sleek purple and white brand aesthetics, interactive display consoles, and high-visibility suspended signage.',
            'caption': 'Technostacks — Immersive Solutions & Digital Twin Booth E26',
            'tags': ['Tech Stall', 'Booth E26', 'Digital Twin', 'Interactive Display'],
            'isLead': True
        }

    # 18. Tech Expo Walkthrough, Experience Zone & Brand Pavilions
    if 'experience zone' in txt or 'tech expo' in txt or fname.startswith('dsc'):
        return {
            'projectId': 'tech-expo-pavilions',
            'projectTitle': f'Tech Expo 2024 — Pavilion View ({filename})',
            'client': 'Tech Expo / Brand Pavilions',
            'category': 'pavilions',
            'categoryLabel': 'Brand Pavilions & Activations',
            'event': 'Gujarat Tech Expo 2024',
            'location': 'Ahmedabad, Gujarat',
            'year': '2024',
            'boothNumber': 'Experience Zone',
            'specs': 'Large-Span Trusses, Directional Expo Signage, Thematic Zone Portals',
            'description': 'On-site execution, custom entrance arches, thematic brand activations, and stall fabrication across the venue.',
            'caption': f'Tech Expo 2024 — Pavilion & Booth Architecture',
            'tags': ['Experience Zone', 'Turnkey Expo', 'Brand Activation', 'Pavilion'],
            'isLead': False
        }

    # Default fallback for any other photo
    return {
        'projectId': 'general-exhibition-showcase',
        'projectTitle': f'Bespoke Exhibition Stall Installation',
        'client': 'Trade Fair Client',
        'category': 'custom-stalls',
        'categoryLabel': 'Custom Exhibition Stalls',
        'event': 'Commercial Trade Fair',
        'location': 'Ahmedabad / International',
        'year': '2024',
        'boothNumber': 'Exhibition Stand',
        'specs': 'Custom Carpentry, Octanorm Integration, Backlit Graphics',
        'description': 'Custom exhibition stand designed and fabricated with precision detailing.',
        'caption': 'Custom Exhibition Fabrication View',
        'tags': ['Custom Stall', 'Turnkey Fabrication', 'Trade Fair'],
        'isLead': False
    }

# Gather all input images
input_candidates = []

# 1. From ..\Archive\images
for root, _, files in os.walk(r'..\Archive\images'):
    for f in files:
        if f.lower().endswith(('.jpg', '.jpeg', '.png')) and f not in skip_files:
            full_path = os.path.join(root, f)
            input_candidates.append((f, full_path))

# 2. From extracted_pdf
for root, _, files in os.walk(r'.\extracted_pdf'):
    for f in files:
        if f.lower().endswith(('.jpg', '.jpeg', '.png')):
            full_path = os.path.join(root, f)
            input_candidates.append((f, full_path))

print(f'Total candidates to process: {len(input_candidates)}')

processed_manifest = []

for idx, (filename, full_path) in enumerate(input_candidates):
    ocr_txt = ocr_data.get(filename, '')
    meta = classify_image(filename, ocr_txt)
    
    # Generate clean web safe output name
    clean_base = filename.replace(' ', '_').replace('(', '').replace(')', '').replace('@', '').replace('=', '').replace('__', '_')
    clean_base = os.path.splitext(clean_base)[0] + '.webp'
    
    thumb_path = os.path.join(thumbs_dir, clean_base)
    opt_path = os.path.join(opt_dir, clean_base)
    
    with Image.open(full_path) as raw_im:
        # Respect camera EXIF orientation tag (auto-rotates portrait shots upright)
        im = ImageOps.exif_transpose(raw_im)
        # Fix camera misorientation for Syndell team photo so team stands upright
        if filename == 'DSC06215.jpg':
            im = im.rotate(-90, expand=True)
        orig_w, orig_h = im.size
        im_rgb = im.convert('RGB')
        
        # 1. Save optimized full-res (max 1920)
        max_dim = 1920
        if max(orig_w, orig_h) > max_dim:
            scale = max_dim / max(orig_w, orig_h)
            new_w, new_h = int(orig_w * scale), int(orig_h * scale)
            im_opt = im_rgb.resize((new_w, new_h), Image.LANCZOS)
        else:
            im_opt = im_rgb
            new_w, new_h = orig_w, orig_h
        
        # Apply watermark to full resolution image
        im_opt_wm = apply_watermark(im_opt, size_ratio=0.22, opacity=0.78)
        im_opt_wm.save(opt_path, 'WEBP', quality=85, method=4)
        
        # 2. Save thumbnail (max 720)
        max_thumb = 720
        if max(orig_w, orig_h) > max_thumb:
            scale_t = max_thumb / max(orig_w, orig_h)
            tw, th = int(orig_w * scale_t), int(orig_h * scale_t)
            im_thumb = im_rgb.resize((tw, th), Image.LANCZOS)
        else:
            im_thumb = im_rgb
            tw, th = orig_w, orig_h
            
        # Apply watermark to thumbnail
        im_thumb_wm = apply_watermark(im_thumb, size_ratio=0.24, opacity=0.75)
        im_thumb_wm.save(thumb_path, 'WEBP', quality=80, method=4)
        
        aspect = round(orig_w / orig_h, 3)
        
        item_record = {
            'id': f'stall-{idx+1}',
            'filename': filename,
            'cleanName': clean_base,
            'title': meta['projectTitle'],
            'client': meta['client'],
            'category': meta['category'],
            'categoryLabel': meta['categoryLabel'],
            'event': meta['event'],
            'location': meta['location'],
            'year': meta['year'],
            'boothNumber': meta['boothNumber'],
            'specs': meta['specs'],
            'description': meta['description'],
            'caption': meta['caption'],
            'tags': meta['tags'],
            'projectId': meta['projectId'],
            'isLead': meta['isLead'],
            'width': orig_w,
            'height': orig_h,
            'optWidth': new_w,
            'optHeight': new_h,
            'thumbWidth': tw,
            'thumbHeight': th,
            'aspectRatio': aspect,
            'thumbUrl': f'/images/thumbs/{clean_base}',
            'fullUrl': f'/images/optimized/{clean_base}'
        }
        processed_manifest.append(item_record)

print(f'Successfully processed and optimized {len(processed_manifest)} images!')

# Priority ordering: Razorpay, factoHR, and premier big brand stalls first
def calculate_stall_priority(item):
    fn = item['filename'].lower()
    pid = item['projectId'].lower()
    c = item['client'].lower()
    
    # Priority Tier 1: Razorpay
    if 'razorpay' in c or 'razorpay' in pid or fn in ['dsc09735.jpg', 'dsc09732.jpg', 'dsc09736.jpg', 'whatsapp image 2024-12-21 at 12.17.13 pm (1).jpeg']:
        if fn == 'dsc09735.jpg': return (1, 1) # lead shot
        if fn == 'dsc09732.jpg': return (1, 2)
        if fn == 'dsc09736.jpg': return (1, 3)
        return (1, 4)
        
    # Priority Tier 2: factoHR
    if 'factohr' in c or 'factohr' in pid or fn in ['dsc09711.jpg', 'dsc09712.jpg', 'whatsapp image 2024-12-21 at 12.17.13 pm.jpeg']:
        if fn == 'dsc09711.jpg': return (2, 1) # lead shot
        if fn == 'dsc09712.jpg': return (2, 2)
        return (2, 3)
        
    # Priority Tier 3: Big Stalls & Premier Brand Pavilions
    if 'benefex' in pid:
        return (3, 1) # London pavilion
    if 'technobrains' in pid and fn == 'dsc09686.jpg':
        return (3, 2) # Organiser flagship pavilion lead
    if 'chambury' in pid:
        return (3, 3) # Birmingham pavilion
    if 'appaspect' in pid and fn == 'dsc05907.jpg':
        return (3, 4) # Corner pavilion
    if 'technostacks' in pid and fn == 'dsc05940.jpg':
        return (3, 5) # Booth E26
    if 'syndell' in pid and fn == 'dsc06224.jpg':
        return (3, 6) # Main corridor stand
    if 'magnusminds' in pid and fn == 'dsc05911.jpg':
        return (3, 7) # Wide pavilion
    if 'radix' in pid and fn == 'radix_view_1.jpg':
        return (3, 8) # Radix 3D island
    if 'technobrains' in pid:
        return (3, 9)
    if 'appaspect' in pid:
        return (3, 10)
    if 'technostacks' in pid:
        return (3, 11)
    if 'syndell' in pid:
        return (3, 12)
    if 'magnusminds' in pid:
        return (3, 13)
        
    return (10, 0)

processed_manifest.sort(key=calculate_stall_priority)

# Reassign sequential stall IDs
for idx, item in enumerate(processed_manifest):
    item['id'] = f'stall-{idx+1}'

# Save JSON manifest to public
with open(os.path.join('public', 'projectsManifest.json'), 'w', encoding='utf-8') as f:
    json.dump(processed_manifest, f, indent=2)

# Also create TypeScript data file for zero-latency client bundling
os.makedirs(os.path.join('src', 'data'), exist_ok=True)
ts_content = f"""// Auto-generated real portfolio dataset for Reworkzone Stalls
export interface ProjectImage {{
  id: string;
  filename: string;
  cleanName: string;
  title: string;
  client: string;
  category: 'custom-stalls' | 'tech-corporate' | '3d-concepts' | 'international' | 'pavilions';
  categoryLabel: string;
  event: string;
  location: string;
  year: string;
  boothNumber: string;
  specs: string;
  description: string;
  caption: string;
  tags: string[];
  projectId: string;
  isLead: boolean;
  width: number;
  height: number;
  optWidth: number;
  optHeight: number;
  thumbWidth: number;
  thumbHeight: number;
  aspectRatio: number;
  thumbUrl: string;
  fullUrl: string;
}}

export interface ProjectGroup {{
  projectId: string;
  title: string;
  client: string;
  category: 'custom-stalls' | 'tech-corporate' | '3d-concepts' | 'international' | 'pavilions';
  categoryLabel: string;
  event: string;
  location: string;
  year: string;
  boothNumber: string;
  specs: string;
  description: string;
  leadImage: ProjectImage;
  images: ProjectImage[];
}}

export const ALL_PROJECT_IMAGES: ProjectImage[] = {json.dumps(processed_manifest, indent=2)};

// Derived distinct grouped projects
export const PROJECT_GROUPS: ProjectGroup[] = (() => {{
  const map = new Map<string, ProjectGroup>();
  for (const img of ALL_PROJECT_IMAGES) {{
    if (!map.has(img.projectId)) {{
      map.set(img.projectId, {{
        projectId: img.projectId,
        title: img.title,
        client: img.client,
        category: img.category,
        categoryLabel: img.categoryLabel,
        event: img.event,
        location: img.location,
        year: img.year,
        boothNumber: img.boothNumber,
        specs: img.specs,
        description: img.description,
        leadImage: img,
        images: []
      }});
    }}
    const group = map.get(img.projectId)!;
    group.images.push(img);
    if (img.isLead) {{
      group.leadImage = img;
    }}
  }}
  return Array.from(map.values());
}})();

export const CATEGORIES = [
  {{ id: 'all', label: 'All Projects', count: ALL_PROJECT_IMAGES.length }},
  {{ id: 'custom-stalls', label: 'Custom Exhibition Stalls', count: ALL_PROJECT_IMAGES.filter(i => i.category === 'custom-stalls').length }},
  {{ id: 'tech-corporate', label: 'Tech & Corporate Expo', count: ALL_PROJECT_IMAGES.filter(i => i.category === 'tech-corporate').length }},
  {{ id: '3d-concepts', label: '3D Concepts & Renders', count: ALL_PROJECT_IMAGES.filter(i => i.category === '3d-concepts').length }},
  {{ id: 'international', label: 'International (London & Birmingham)', count: ALL_PROJECT_IMAGES.filter(i => i.category === 'international').length }},
  {{ id: 'pavilions', label: 'Brand Pavilions & Activations', count: ALL_PROJECT_IMAGES.filter(i => i.category === 'pavilions').length }}
];
"""

with open(os.path.join('src', 'data', 'projectsData.ts'), 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("Created src/data/projectsData.ts and public/projectsManifest.json successfully!")
