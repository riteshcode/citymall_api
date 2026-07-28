// Static seed fixtures for Aali Market: categories + ~40 bilingual products.
// All prices are integer paise (₹1 = 100 paise).

export const categories = [
  { name: { en: 'Fruits & Vegetables', hi: 'फल और सब्जियां' }, slug: 'fruits-vegetables', sortOrder: 1 },
  { name: { en: 'Dairy & Breakfast', hi: 'डेयरी और नाश्ता' }, slug: 'dairy-breakfast', sortOrder: 2 },
  { name: { en: 'Grocery & Staples', hi: 'किराना और राशन' }, slug: 'grocery-staples', sortOrder: 3 },
  { name: { en: 'Snacks & Munchies', hi: 'नमकीन और स्नैक्स' }, slug: 'snacks-munchies', sortOrder: 4 },
  { name: { en: 'Beverages', hi: 'पेय पदार्थ' }, slug: 'beverages', sortOrder: 5 },
  { name: { en: 'Personal Care', hi: 'व्यक्तिगत देखभाल' }, slug: 'personal-care', sortOrder: 6 },
  { name: { en: 'Home Care', hi: 'घर की सफाई' }, slug: 'home-care', sortOrder: 7 },
  { name: { en: 'Baby Care', hi: 'शिशु देखभाल' }, slug: 'baby-care', sortOrder: 8 },
];

// [categorySlug, en title, hi title, brand, unit, mrpPaise, pricePaise, stock, tags[]]
export const productRows = [
  // Fruits & Vegetables
  ['fruits-vegetables', 'Fresh Onion', 'ताज़ा प्याज़', 'Farm Fresh', '1 kg', 4000, 3200, 120, ['onion', 'vegetable']],
  ['fruits-vegetables', 'Potato', 'आलू', 'Farm Fresh', '1 kg', 3000, 2500, 150, ['potato', 'vegetable']],
  ['fruits-vegetables', 'Tomato', 'टमाटर', 'Farm Fresh', '1 kg', 3500, 2800, 100, ['tomato', 'vegetable']],
  ['fruits-vegetables', 'Banana', 'केला', 'Farm Fresh', '6 pcs', 3600, 3000, 90, ['banana', 'fruit']],
  ['fruits-vegetables', 'Apple (Shimla)', 'सेब (शिमला)', 'Farm Fresh', '4 pcs', 12000, 9900, 60, ['apple', 'fruit']],

  // Dairy & Breakfast
  ['dairy-breakfast', 'Toned Milk', 'टोंड दूध', 'Aali Dairy', '500 ml', 3000, 2800, 200, ['milk', 'dairy']],
  ['dairy-breakfast', 'Curd (Dahi)', 'दही', 'Aali Dairy', '400 g', 3500, 3200, 150, ['curd', 'dahi', 'dairy']],
  ['dairy-breakfast', 'Paneer', 'पनीर', 'Aali Dairy', '200 g', 9000, 8500, 70, ['paneer', 'dairy']],
  ['dairy-breakfast', 'Butter', 'मक्खन', 'Amul', '100 g', 5500, 5200, 90, ['butter', 'dairy']],
  ['dairy-breakfast', 'Bread (White)', 'ब्रेड (सफ़ेद)', 'Britannia', '400 g', 4500, 4000, 100, ['bread', 'breakfast']],

  // Grocery & Staples
  ['grocery-staples', 'Aata (Whole Wheat Flour)', 'आटा (गेहूं का आटा)', 'Aashirvaad', '5 kg', 27500, 24900, 80, ['atta', 'flour', 'staple']],
  ['grocery-staples', 'Basmati Rice', 'बासमती चावल', 'India Gate', '5 kg', 65000, 57500, 60, ['rice', 'staple']],
  ['grocery-staples', 'Toor Dal', 'तूर दाल', 'Tata Sampann', '1 kg', 18500, 16900, 90, ['dal', 'pulses', 'staple']],
  ['grocery-staples', 'Moong Dal', 'मूंग दाल', 'Tata Sampann', '1 kg', 15500, 13900, 90, ['dal', 'pulses', 'staple']],
  ['grocery-staples', 'Sunflower Oil', 'सूरजमुखी तेल', 'Fortune', '1 L', 19500, 17900, 100, ['oil', 'staple']],
  ['grocery-staples', 'Mustard Oil', 'सरसों का तेल', 'Fortune', '1 L', 21000, 18900, 80, ['oil', 'staple']],
  ['grocery-staples', 'Sugar', 'चीनी', 'Madhur', '1 kg', 4800, 4400, 150, ['sugar', 'staple']],
  ['grocery-staples', 'Iodised Salt', 'आयोडीन नमक', 'Tata Salt', '1 kg', 2800, 2500, 200, ['salt', 'staple']],
  ['grocery-staples', 'Turmeric Powder', 'हल्दी पाउडर', 'Everest', '200 g', 5500, 4900, 100, ['masala', 'spice']],
  ['grocery-staples', 'Red Chilli Powder', 'लाल मिर्च पाउडर', 'Everest', '200 g', 6000, 5400, 100, ['masala', 'spice']],

  // Snacks & Munchies
  ['snacks-munchies', 'Potato Chips (Classic Salted)', 'आलू चिप्स (क्लासिक नमकीन)', 'Lay\'s', '52 g', 2000, 1800, 200, ['chips', 'snacks']],
  ['snacks-munchies', 'Namkeen Mixture', 'नमकीन मिक्सचर', 'Haldiram\'s', '200 g', 6000, 5400, 120, ['namkeen', 'snacks']],
  ['snacks-munchies', 'Glucose Biscuits', 'ग्लूकोज़ बिस्कुट', 'Parle-G', '250 g', 3000, 2700, 250, ['biscuit', 'snacks']],
  ['snacks-munchies', 'Cream Biscuits', 'क्रीम बिस्कुट', 'Britannia', '150 g', 3500, 3100, 150, ['biscuit', 'snacks']],
  ['snacks-munchies', 'Instant Noodles', 'इंस्टेंट नूडल्स', 'Maggi', '280 g (4 pack)', 6000, 5500, 200, ['noodles', 'snacks']],

  // Beverages
  ['beverages', 'Cola Soft Drink', 'कोला सॉफ्ट ड्रिंक', 'Coca-Cola', '750 ml', 4000, 3600, 150, ['soft-drink', 'beverage']],
  ['beverages', 'Orange Juice', 'ऑरेंज जूस', 'Real', '1 L', 12000, 10900, 90, ['juice', 'beverage']],
  ['beverages', 'Instant Coffee', 'इंस्टेंट कॉफ़ी', 'Nescafé', '50 g', 19000, 17500, 70, ['coffee', 'beverage']],
  ['beverages', 'Mineral Water', 'मिनरल वाटर', 'Bisleri', '1 L', 2000, 1800, 300, ['water', 'beverage']],

  // Personal Care
  ['personal-care', 'Bathing Soap', 'नहाने का साबुन', 'Lifebuoy', '125 g', 4000, 3500, 200, ['soap', 'personal-care']],
  ['personal-care', 'Toothpaste', 'टूथपेस्ट', 'Colgate', '150 g', 9500, 8500, 150, ['toothpaste', 'personal-care']],
  ['personal-care', 'Shampoo', 'शैम्पू', 'Head & Shoulders', '340 ml', 32000, 28500, 90, ['shampoo', 'personal-care']],
  ['personal-care', 'Hand Sanitizer', 'हैंड सैनिटाइज़र', 'Dettol', '200 ml', 12000, 10500, 100, ['sanitizer', 'personal-care']],

  // Home Care
  ['home-care', 'Dishwash Bar', 'बर्तन धोने की बार', 'Vim', '200 g', 3000, 2600, 150, ['dishwash', 'home-care']],
  ['home-care', 'Detergent Powder', 'डिटर्जेंट पाउडर', 'Surf Excel', '1 kg', 20000, 17900, 100, ['detergent', 'home-care']],
  ['home-care', 'Floor Cleaner', 'फ्लोर क्लीनर', 'Lizol', '975 ml', 21000, 18900, 80, ['floor-cleaner', 'home-care']],
  ['home-care', 'Toilet Cleaner', 'टॉयलेट क्लीनर', 'Harpic', '500 ml', 12500, 10900, 90, ['toilet-cleaner', 'home-care']],

  // Baby Care
  ['baby-care', 'Baby Diapers (M)', 'बेबी डायपर (M)', 'Pampers', '38 pcs', 65000, 58900, 60, ['diapers', 'baby-care']],
  ['baby-care', 'Baby Wipes', 'बेबी वाइप्स', 'Himalaya', '72 pcs', 22000, 19500, 70, ['wipes', 'baby-care']],
  ['baby-care', 'Baby Powder', 'बेबी पाउडर', 'Johnson\'s', '200 g', 15000, 13500, 65, ['baby-powder', 'baby-care']],
];
