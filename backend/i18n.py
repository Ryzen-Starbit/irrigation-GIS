MR = {
    # villages / canals
    'Digras Bk': 'दिग्रस बुद्रुक', 'Takarkhed Wayal': 'टाकरखेड वायाळ',
    'Left Bank Canal': 'डावा तीर कालवा', 'Amona Tail Minor': 'आमोणा टेल मायनर', 'Minor 5': 'मायनर ५', 'Minor 6': 'मायनर ६',
    'LBC': 'डावा तीर कालवा', 'AMONA TAIL MINOR': 'आमोणा टेल मायनर', 'MINOR-5': 'मायनर ५', 'MINOR-6': 'मायनर ६',
    # seasons, reach, irrigation
    'Kharif': 'खरीप', 'Rabi': 'रब्बी', 'Hot weather': 'उन्हाळी',
    'Head': 'सुरुवातीचा', 'Middle': 'मध्यावरील', 'Tail': 'शेवटचा',
    'Canal': 'कालवा', 'Well': 'विहीर', 'Rainfed': 'कोरडवाहू',
    # crops
    'Soybean': 'सोयाबीन', 'Cotton': 'कापूस', 'Tur': 'तूर', 'Jowar': 'ज्वारी', 'Moong': 'मूग', 'Udid': 'उडीद',
    'Sugarcane': 'ऊस', 'Orange': 'संत्रा', 'Gram (Harbhara)': 'हरभरा', 'Wheat': 'गहू', 'Onion': 'कांदा',
    'Fodder': 'चारा', 'Groundnut': 'भुईमूग', 'Vegetables': 'भाजीपाला',
    # labels
    'Summary': 'सारांश', 'Gats': 'गट', 'Owners': 'खातेदार', 'Season': 'हंगाम',
    'Gat Nos.': 'गट संख्या', 'Farmers': 'शेतकरी', 'Total area (ha)': 'एकूण क्षेत्र (हे.)', 'GCA (ha)': 'GCA (हे.)',
    'Pot Kharab (ha)': 'पोट खराब (हे.)', 'CCA (ha)': 'CCA (हे.)', 'ICA (ha)': 'ICA (हे.)', 'Crop': 'पीक', 'Area (ha)': 'क्षेत्र (हे.)',
    'village': 'गाव', 'gat_no': 'गट नं.', 'total_ha': 'एकूण क्षेत्र', 'gca_ha': 'GCA', 'pot_kharab_ha': 'पोट खराब',
    'cca_ha': 'CCA', 'ica_ha': 'ICA', 'chak_no': 'चक नं.', 'outlet': 'विमोचक', 'canal_id': 'कालवा', 'reach': 'भाग',
    'crop': 'पीक', 'irrigation': 'सिंचन', 'owner_count': 'खातेदार संख्या', 'owner_first': 'खातेदार', 'owner': 'खातेदार',
    'area_ha': 'क्षेत्र (हे.)',
}

def tr(word, lang):
    if lang != 'mr' or word is None:
        return word
    return MR.get(word, word)
