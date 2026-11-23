/**
 * FoodBridge - Social Impact Surplus Food Redistribution Platform
 * Backend Server with built-in SQLite Database (Node.js 26.13.1 native node:sqlite)
 * Zero external dependencies required.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'foodbridge.db');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize SQLite database
const db = new DatabaseSync(DB_FILE);

// Setup database tables
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT,
      fssai_license TEXT,
      operating_hours TEXT,
      verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ngos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      beneficiaries_daily INTEGER DEFAULT 50,
      vehicle_type TEXT DEFAULT 'Van',
      verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurant_id INTEGER,
      restaurant_name TEXT NOT NULL,
      food_name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity_servings INTEGER NOT NULL,
      quantity_unit TEXT DEFAULT 'portions',
      dietary TEXT DEFAULT 'Vegetarian',
      prepared_at TEXT NOT NULL,
      pickup_deadline TEXT NOT NULL,
      storage_notes TEXT,
      packaging_type TEXT DEFAULT 'Sealed Food Containers',
      pickup_address TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      special_instructions TEXT,
      status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, CLAIMED, COLLECTED, EXPIRED, CANCELLED
      claimed_by_ngo_id INTEGER,
      claimed_by_ngo_name TEXT,
      claimed_at DATETIME,
      collected_at DATETIME,
      distribution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
      FOREIGN KEY (claimed_by_ngo_id) REFERENCES ngos(id)
    );

    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL,
      ngo_id INTEGER,
      ngo_name TEXT NOT NULL,
      estimated_pickup_time TEXT NOT NULL,
      volunteer_name TEXT NOT NULL,
      volunteer_phone TEXT NOT NULL,
      notes TEXT,
      status TEXT DEFAULT 'CONFIRMED', -- CONFIRMED, COLLECTED, CANCELLED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listing_id) REFERENCES listings(id),
      FOREIGN KEY (ngo_id) REFERENCES ngos(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL, -- LISTING_CREATED, CLAIM_SUBMITTED, FOOD_COLLECTED, RESTAURANT_REGISTERED, NGO_REGISTERED, STATUS_UPDATED
      actor_type TEXT NOT NULL, -- RESTAURANT, NGO, ADMIN, SYSTEM
      actor_name TEXT NOT NULL,
      description TEXT NOT NULL,
      entity_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed initial data if tables are empty
  const count = db.prepare('SELECT COUNT(*) as count FROM restaurants').get().count;
  if (count === 0) {
    seedDatabase();
  }
}

function logActivity(eventType, actorType, actorName, description, entityId = null) {
  try {
    const stmt = db.prepare(`
      INSERT INTO activity_logs (event_type, actor_type, actor_name, description, entity_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(eventType, actorType, actorName, description, entityId);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

function seedDatabase() {
  console.log('Seeding initial FoodBridge sample data...');

  // Restaurants
  const insertRest = db.prepare(`
    INSERT INTO restaurants (name, contact_person, phone, email, address, city, area, fssai_license, operating_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRest.run('Green Leaf Bistro & Banquet', 'Chef Rajesh Sharma', '+91 98201 12345', 'info@greenleafbistro.com', 'Plot 42, Bandra West, Linking Road', 'Mumbai', 'Bandra', 'FSSAI-115200123984', '11:00 AM - 11:00 PM');
  insertRest.run('Royal Spice Kitchen', 'Priya Kapoor', '+91 98112 54321', 'orders@royalspice.in', 'Shop 14, Sector 18, Commercial Market', 'Noida', 'Sector 18', 'FSSAI-10019051000213', '12:00 PM - 11:30 PM');
  insertRest.run('The Daily Crust Bakery & Cafe', 'Farhan Merchant', '+91 98450 99881', 'farhan@dailycrust.co', '88 Indiranagar 100ft Road', 'Bengaluru', 'Indiranagar', 'FSSAI-11219334000451', '08:00 AM - 10:00 PM');
  insertRest.run('Annapurna Caterers & Events', 'Suresh Patel', '+91 98790 33221', 'events@annapurnacater.com', 'CG Road, Navrangpura', 'Ahmedabad', 'Navrangpura', 'FSSAI-10718012000567', '09:00 AM - 12:00 AM');

  // NGOs
  const insertNgo = db.prepare(`
    INSERT INTO ngos (name, registration_number, contact_person, phone, email, address, city, beneficiaries_daily, vehicle_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNgo.run('Hope for All Relief Foundation', 'NGO-MH-2019-8834', 'Sunita Rao', '+91 98205 77665', 'sunita@hopeforallrelief.org', '12 Santacruz East Community Center', 'Mumbai', 240, 'Insulated Van');
  insertNgo.run('Robin Meal Share Network', 'NGO-DL-2021-1049', 'Aman Verma', '+91 98104 22331', 'contact@robinmealshare.org', 'Sector 15 Community Kitchen, Metro Hub', 'Noida', 180, 'Two-Wheelers & Small Van');
  insertNgo.run('FeedTheCity Bengaluru', 'NGO-KA-2018-4421', 'Deepa Nair', '+91 98801 44556', 'deepa@feedthecityblr.org', '34 Koramangala 4th Block', 'Bengaluru', 320, 'Refrigerated Delivery Van');

  // Listings (incorporating example from Slide 05: Vegetable Pulao, 40 meal portions, 6:00 PM / 8:00 PM)
  const insertListing = db.prepare(`
    INSERT INTO listings (
      restaurant_id, restaurant_name, food_name, category, quantity_servings, quantity_unit,
      dietary, prepared_at, pickup_deadline, storage_notes, packaging_type, pickup_address,
      contact_person, contact_phone, special_instructions, status, claimed_by_ngo_id,
      claimed_by_ngo_name, claimed_at, collected_at, distribution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Active Available Listing 1 (Vegetable Pulao directly from slide 05)
  insertListing.run(
    1, 'Green Leaf Bistro & Banquet', 'Vegetable Pulao with Raita', 'Cooked Meals', 40, 'meal portions',
    'Vegetarian', 'Today 6:00 PM', 'Today 8:00 PM', 'Kept hot in commercial thermal warmer >65°C', 'Packed in large food-grade trays',
    'Plot 42, Bandra West, Linking Road', 'Chef Rajesh Sharma', '+91 98201 12345',
    'Collect from rear kitchen dispatch gate. Mention FoodBridge pickup.', 'AVAILABLE',
    null, null, null, null, null
  );

  // Active Available Listing 2
  insertListing.run(
    2, 'Royal Spice Kitchen', 'Paneer Butter Masala & Tandoori Roti', 'Cooked Meals', 35, 'meal portions',
    'Vegetarian', 'Today 5:30 PM', 'Today 9:00 PM', 'Sealed containers, stored at room temperature ready for dispatch', '10 airtight containers + foil wrapped rotis',
    'Shop 14, Sector 18, Commercial Market', 'Priya Kapoor', '+91 98112 54321',
    'Park near Gate 2 for easy loading into van.', 'AVAILABLE',
    null, null, null, null, null
  );

  // Active Available Listing 3
  insertListing.run(
    3, 'The Daily Crust Bakery & Cafe', 'Artisanal Multigrain Breads & Croissants', 'Bakery & Breads', 50, 'portions',
    'Vegetarian', 'Today 4:00 PM', 'Tomorrow 10:00 AM', 'Fresh baked today, stored in clean dry bakery racks', 'Paper bread bags and cardboard crates',
    '88 Indiranagar 100ft Road', 'Farhan Merchant', '+91 98450 99881',
    'Ask for Farhan at counter. Crates must be returned next day.', 'AVAILABLE',
    null, null, null, null, null
  );

  // Claimed Listing 4
  insertListing.run(
    4, 'Annapurna Caterers & Events', 'Dal Makhani, Jeera Rice & Mix Veg Curry', 'Cooked Meals', 80, 'meal portions',
    'Vegetarian', 'Today 3:00 PM', 'Today 7:30 PM', 'Maintained hot in insulated banquet chafing vessels', 'Bring 4-5 stainless steel collection containers',
    'CG Road, Navrangpura', 'Suresh Patel', '+91 98790 33221',
    'Buffet excess from lunch seminar. Untouched and high quality.', 'CLAIMED',
    1, 'Hope for All Relief Foundation', new Date(Date.now() - 3600000).toISOString(), null, null
  );

  // Completed / Collected Listing 5
  insertListing.run(
    1, 'Green Leaf Bistro & Banquet', 'Assorted Sandwiches & Fruit Salad Cups', 'Cooked Meals', 25, 'meal portions',
    'Vegetarian', 'Yesterday 5:00 PM', 'Yesterday 7:30 PM', 'Chilled in cold room at 3°C', 'Individually packed in eco-friendly boxes',
    'Plot 42, Bandra West, Linking Road', 'Chef Rajesh Sharma', '+91 98201 12345',
    'Successfully handed over to Hope for All volunteer.', 'COLLECTED',
    1, 'Hope for All Relief Foundation', new Date(Date.now() - 86400000).toISOString(), new Date(Date.now() - 82800000).toISOString(),
    'Distributed to 25 children and mothers at Bandra transit shelter.'
  );

  // Add sample claim
  const insertClaim = db.prepare(`
    INSERT INTO claims (listing_id, ngo_id, ngo_name, estimated_pickup_time, volunteer_name, volunteer_phone, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertClaim.run(
    4, 1, 'Hope for All Relief Foundation', 'Today 7:00 PM', 'Sunita Rao', '+91 98205 77665',
    'Our rescue van is en route with thermal containers.', 'CONFIRMED'
  );
  insertClaim.run(
    5, 1, 'Hope for All Relief Foundation', 'Yesterday 6:30 PM', 'Ramesh Jadhav', '+91 98205 77669',
    'Pickup completed on schedule.', 'COLLECTED'
  );

  // Activity logs
  logActivity('RESTAURANT_REGISTERED', 'RESTAURANT', 'Green Leaf Bistro & Banquet', 'Registered as partner restaurant in Bandra, Mumbai', 1);
  logActivity('NGO_REGISTERED', 'NGO', 'Hope for All Relief Foundation', 'Registered as verified food rescue NGO', 1);
  logActivity('LISTING_CREATED', 'RESTAURANT', 'Green Leaf Bistro & Banquet', 'Listed 40 meal portions of Vegetable Pulao with Raita', 1);
  logActivity('LISTING_CREATED', 'RESTAURANT', 'Royal Spice Kitchen', 'Listed 35 meal portions of Paneer Butter Masala & Tandoori Roti', 2);
  logActivity('LISTING_CREATED', 'RESTAURANT', 'The Daily Crust Bakery & Cafe', 'Listed 50 portions of Artisanal Multigrain Breads', 3);
  logActivity('CLAIM_SUBMITTED', 'NGO', 'Hope for All Relief Foundation', 'Claimed listing #4 (80 meal portions of Dal Makhani & Rice)', 4);
  logActivity('FOOD_COLLECTED', 'NGO', 'Hope for All Relief Foundation', 'Successfully collected and distributed 25 meals from Green Leaf Bistro', 5);

  console.log('Seeding completed successfully!');
}

// Request helpers
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) { // 5MB guard
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// API Routes Dispatcher
async function handleApiRequest(req, res, pathname, query) {
  const method = req.method;

  // 1. STATS & IMPACT METRICS (Slide 07)
  if (pathname === '/api/stats' && method === 'GET') {
    const totalListings = db.prepare('SELECT COUNT(*) as count FROM listings').get().count;
    const availableListings = db.prepare("SELECT COUNT(*) as count FROM listings WHERE status = 'AVAILABLE'").get().count;
    const claimedListings = db.prepare("SELECT COUNT(*) as count FROM listings WHERE status = 'CLAIMED'").get().count;
    const collectedListings = db.prepare("SELECT COUNT(*) as count FROM listings WHERE status = 'COLLECTED'").get().count;
    const totalRestaurants = db.prepare('SELECT COUNT(*) as count FROM restaurants').get().count;
    const totalNgos = db.prepare('SELECT COUNT(*) as count FROM ngos').get().count;
    const totalClaims = db.prepare('SELECT COUNT(*) as count FROM claims').get().count;

    // Rescued servings total
    const totalServingsAvailable = db.prepare("SELECT COALESCE(SUM(quantity_servings), 0) as total FROM listings WHERE status = 'AVAILABLE'").get().total;
    const totalServingsRescued = db.prepare("SELECT COALESCE(SUM(quantity_servings), 0) as total FROM listings WHERE status IN ('CLAIMED', 'COLLECTED')").get().total;
    const totalServingsDistributed = db.prepare("SELECT COALESCE(SUM(quantity_servings), 0) as total FROM listings WHERE status = 'COLLECTED'").get().total;

    // Estimated food weight saved in kg (~0.35kg per portion) and CO2 avoided (~2.5kg CO2e per kg food saved)
    const estKgFoodRescued = Math.round(totalServingsRescued * 0.38);
    const estCo2PreventedKg = Math.round(estKgFoodRescued * 2.5);

    return sendJSON(res, 200, {
      totalListings,
      availableListings,
      claimedListings,
      collectedListings,
      totalRestaurants,
      totalNgos,
      totalClaims,
      totalServingsAvailable,
      totalServingsRescued,
      totalServingsDistributed,
      estKgFoodRescued,
      estCo2PreventedKg
    });
  }

  // 2. ALL ENTRIES (Explicit User Request: "I ALSO WANT TO SEE ALL THE ENTRIES THAT HAVE BEEN ENTERED BY THE USER")
  if (pathname === '/api/all-entries' && method === 'GET') {
    const search = query.get('search') ? `%${query.get('search').toLowerCase()}%` : null;
    const status = query.get('status');
    const category = query.get('category');

    let listingsSql = 'SELECT * FROM listings WHERE 1=1';
    const params = [];

    if (status && status !== 'ALL') {
      listingsSql += ' AND status = ?';
      params.push(status);
    }
    if (category && category !== 'ALL') {
      listingsSql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      listingsSql += ' AND (LOWER(food_name) LIKE ? OR LOWER(restaurant_name) LIKE ? OR LOWER(pickup_address) LIKE ?)';
      params.push(search, search, search);
    }
    listingsSql += ' ORDER BY id DESC';

    const listings = db.prepare(listingsSql).all(...params);
    const claims = db.prepare('SELECT * FROM claims ORDER BY id DESC').all();
    const restaurants = db.prepare('SELECT * FROM restaurants ORDER BY id DESC').all();
    const ngos = db.prepare('SELECT * FROM ngos ORDER BY id DESC').all();
    const activityLogs = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 50').all();

    return sendJSON(res, 200, {
      totalEntries: {
        listings: listings.length,
        claims: claims.length,
        restaurants: restaurants.length,
        ngos: ngos.length,
        activityLogs: activityLogs.length
      },
      listings,
      claims,
      restaurants,
      ngos,
      activityLogs
    });
  }

  // 3. FOOD LISTINGS API
  if (pathname === '/api/listings') {
    if (method === 'GET') {
      const status = query.get('status');
      const category = query.get('category');
      const dietary = query.get('dietary');
      const search = query.get('search');

      let sql = 'SELECT * FROM listings WHERE 1=1';
      const params = [];

      if (status && status !== 'ALL') {
        sql += ' AND status = ?';
        params.push(status);
      }
      if (category && category !== 'ALL') {
        sql += ' AND category = ?';
        params.push(category);
      }
      if (dietary && dietary !== 'ALL') {
        sql += ' AND dietary = ?';
        params.push(dietary);
      }
      if (search) {
        sql += ' AND (LOWER(food_name) LIKE ? OR LOWER(restaurant_name) LIKE ? OR LOWER(pickup_address) LIKE ?)';
        const term = `%${search.toLowerCase()}%`;
        params.push(term, term, term);
      }

      sql += ' ORDER BY id DESC';
      const rows = db.prepare(sql).all(...params);
      return sendJSON(res, 200, rows);
    }

    if (method === 'POST') {
      const data = await parseJSONBody(req);
      if (!data.food_name || !data.restaurant_name || !data.quantity_servings || !data.pickup_deadline || !data.pickup_address) {
        return sendJSON(res, 400, { error: 'Required fields missing: food_name, restaurant_name, quantity_servings, pickup_deadline, pickup_address' });
      }

      const stmt = db.prepare(`
        INSERT INTO listings (
          restaurant_id, restaurant_name, food_name, category, quantity_servings, quantity_unit,
          dietary, prepared_at, pickup_deadline, storage_notes, packaging_type, pickup_address,
          contact_person, contact_phone, special_instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE')
      `);

      const result = stmt.run(
        data.restaurant_id || null,
        data.restaurant_name,
        data.food_name,
        data.category || 'Cooked Meals',
        Number(data.quantity_servings) || 1,
        data.quantity_unit || 'portions',
        data.dietary || 'Vegetarian',
        data.prepared_at || 'Freshly Prepared',
        data.pickup_deadline,
        data.storage_notes || 'Stored safely according to guidelines',
        data.packaging_type || 'Food-grade container',
        data.pickup_address,
        data.contact_person || 'Kitchen Manager',
        data.contact_phone || '',
        data.special_instructions || '',
      );

      const listingId = Number(result.lastInsertRowid);
      logActivity(
        'LISTING_CREATED',
        'RESTAURANT',
        data.restaurant_name,
        `Listed ${data.quantity_servings} portions of ${data.food_name} (${data.category})`,
        listingId
      );

      const created = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
      return sendJSON(res, 201, created);
    }
  }

  // 4. SINGLE LISTING ACTIONS
  const listingIdMatch = pathname.match(/^\/api\/listings\/(\d+)$/);
  if (listingIdMatch) {
    const id = Number(listingIdMatch[1]);
    if (method === 'GET') {
      const item = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
      if (!item) return sendJSON(res, 404, { error: 'Listing not found' });
      return sendJSON(res, 200, item);
    }
    if (method === 'DELETE') {
      const item = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
      if (!item) return sendJSON(res, 404, { error: 'Listing not found' });
      db.prepare('DELETE FROM claims WHERE listing_id = ?').run(id);
      db.prepare('DELETE FROM listings WHERE id = ?').run(id);
      logActivity('LISTING_DELETED', 'ADMIN', 'Admin / User', `Deleted listing #${id} (${item.food_name})`, id);
      return sendJSON(res, 200, { success: true, message: `Listing #${id} deleted` });
    }
  }

  // 5. UPDATE LISTING STATUS
  const listingStatusMatch = pathname.match(/^\/api\/listings\/(\d+)\/status$/);
  if (listingStatusMatch && (method === 'PATCH' || method === 'PUT')) {
    const id = Number(listingStatusMatch[1]);
    const data = await parseJSONBody(req);
    const { status, distribution_notes, claimed_by_ngo_name } = data;

    const item = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
    if (!item) return sendJSON(res, 404, { error: 'Listing not found' });

    let sql = 'UPDATE listings SET status = ?';
    const params = [status];

    if (status === 'COLLECTED') {
      sql += ', collected_at = CURRENT_TIMESTAMP, distribution_notes = COALESCE(?, distribution_notes)';
      params.push(distribution_notes || null);
    } else if (status === 'CLAIMED') {
      sql += ', claimed_at = CURRENT_TIMESTAMP, claimed_by_ngo_name = COALESCE(?, claimed_by_ngo_name)';
      params.push(claimed_by_ngo_name || null);
    } else if (status === 'AVAILABLE') {
      sql += ', claimed_by_ngo_id = NULL, claimed_by_ngo_name = NULL, claimed_at = NULL';
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.prepare(sql).run(...params);

    logActivity(
      'STATUS_UPDATED',
      'USER',
      claimed_by_ngo_name || item.restaurant_name,
      `Updated listing #${id} (${item.food_name}) status to ${status}`,
      id
    );

    const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
    return sendJSON(res, 200, updated);
  }

  // 6. CLAIMS API (Slide 04: NGOs request or claim available food)
  if (pathname === '/api/claims') {
    if (method === 'GET') {
      const rows = db.prepare(`
        SELECT c.*, l.food_name, l.quantity_servings, l.restaurant_name, l.pickup_address, l.pickup_deadline
        FROM claims c
        LEFT JOIN listings l ON c.listing_id = l.id
        ORDER BY c.id DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    if (method === 'POST') {
      const data = await parseJSONBody(req);
      if (!data.listing_id || !data.ngo_name || !data.estimated_pickup_time || !data.volunteer_name || !data.volunteer_phone) {
        return sendJSON(res, 400, { error: 'Required fields: listing_id, ngo_name, estimated_pickup_time, volunteer_name, volunteer_phone' });
      }

      const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(Number(data.listing_id));
      if (!listing) return sendJSON(res, 404, { error: 'Listing not found' });
      if (listing.status !== 'AVAILABLE') {
        return sendJSON(res, 400, { error: `Listing is already ${listing.status}` });
      }

      // Insert claim
      const claimStmt = db.prepare(`
        INSERT INTO claims (listing_id, ngo_id, ngo_name, estimated_pickup_time, volunteer_name, volunteer_phone, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
      `);
      const claimResult = claimStmt.run(
        listing.id,
        data.ngo_id || null,
        data.ngo_name,
        data.estimated_pickup_time,
        data.volunteer_name,
        data.volunteer_phone,
        data.notes || ''
      );

      // Update listing status to CLAIMED
      db.prepare(`
        UPDATE listings
        SET status = 'CLAIMED', claimed_by_ngo_id = ?, claimed_by_ngo_name = ?, claimed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(data.ngo_id || null, data.ngo_name, listing.id);

      const claimId = Number(claimResult.lastInsertRowid);
      logActivity(
        'CLAIM_SUBMITTED',
        'NGO',
        data.ngo_name,
        `Claimed listing #${listing.id}: ${listing.food_name} (${listing.quantity_servings} servings) from ${listing.restaurant_name}`,
        claimId
      );

      const created = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
      return sendJSON(res, 201, created);
    }
  }

  // 7. CLAIM STATUS UPDATE (Confirm Pickup / Mark Collected)
  const claimStatusMatch = pathname.match(/^\/api\/claims\/(\d+)\/status$/);
  if (claimStatusMatch && (method === 'PATCH' || method === 'PUT')) {
    const claimId = Number(claimStatusMatch[1]);
    const data = await parseJSONBody(req);
    const { status, distribution_notes } = data;

    const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
    if (!claim) return sendJSON(res, 404, { error: 'Claim not found' });

    db.prepare('UPDATE claims SET status = ? WHERE id = ?').run(status, claimId);

    // If marked collected, update parent listing as well
    if (status === 'COLLECTED') {
      db.prepare(`
        UPDATE listings
        SET status = 'COLLECTED', collected_at = CURRENT_TIMESTAMP, distribution_notes = ?
        WHERE id = ?
      `).run(distribution_notes || 'Collected and distributed to beneficiaries', claim.listing_id);

      logActivity(
        'FOOD_COLLECTED',
        'NGO',
        claim.ngo_name,
        `Successfully collected and verified distribution for claim #${claimId}`,
        claimId
      );
    }

    const updated = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
    return sendJSON(res, 200, updated);
  }

  // 8. RESTAURANTS API
  if (pathname === '/api/restaurants') {
    if (method === 'GET') {
      const rows = db.prepare(`
        SELECT r.*,
          (SELECT COUNT(*) FROM listings WHERE restaurant_id = r.id) as total_listings_count,
          (SELECT COUNT(*) FROM listings WHERE restaurant_id = r.id AND status = 'AVAILABLE') as active_listings_count
        FROM restaurants r
        ORDER BY r.id DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    if (method === 'POST') {
      const data = await parseJSONBody(req);
      if (!data.name || !data.contact_person || !data.phone || !data.address || !data.city) {
        return sendJSON(res, 400, { error: 'Required fields: name, contact_person, phone, address, city' });
      }

      const stmt = db.prepare(`
        INSERT INTO restaurants (name, contact_person, phone, email, address, city, area, fssai_license, operating_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.name,
        data.contact_person,
        data.phone,
        data.email || '',
        data.address,
        data.city,
        data.area || '',
        data.fssai_license || '',
        data.operating_hours || '10:00 AM - 10:00 PM'
      );

      const id = Number(result.lastInsertRowid);
      logActivity('RESTAURANT_REGISTERED', 'RESTAURANT', data.name, `New restaurant registered in ${data.city}`, id);
      const created = db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id);
      return sendJSON(res, 201, created);
    }
  }

  // 9. NGOS API
  if (pathname === '/api/ngos') {
    if (method === 'GET') {
      const rows = db.prepare(`
        SELECT n.*,
          (SELECT COUNT(*) FROM claims WHERE ngo_id = n.id) as total_claims_count
        FROM ngos n
        ORDER BY n.id DESC
      `).all();
      return sendJSON(res, 200, rows);
    }

    if (method === 'POST') {
      const data = await parseJSONBody(req);
      if (!data.name || !data.registration_number || !data.contact_person || !data.phone || !data.address || !data.city) {
        return sendJSON(res, 400, { error: 'Required fields: name, registration_number, contact_person, phone, address, city' });
      }

      const stmt = db.prepare(`
        INSERT INTO ngos (name, registration_number, contact_person, phone, email, address, city, beneficiaries_daily, vehicle_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.name,
        data.registration_number,
        data.contact_person,
        data.phone,
        data.email || '',
        data.address,
        data.city,
        Number(data.beneficiaries_daily) || 50,
        data.vehicle_type || 'Van'
      );

      const id = Number(result.lastInsertRowid);
      logActivity('NGO_REGISTERED', 'NGO', data.name, `New NGO partner registered: serves ~${data.beneficiaries_daily || 50} meals daily`, id);
      const created = db.prepare('SELECT * FROM ngos WHERE id = ?').get(id);
      return sendJSON(res, 201, created);
    }
  }

  // 10. ACTIVITY LOGS API
  if (pathname === '/api/activity-logs' && method === 'GET') {
    const rows = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 100').all();
    return sendJSON(res, 200, rows);
  }

  // 11. RE-SEED / RESET DEMO DATA
  if (pathname === '/api/reset-demo' && method === 'POST') {
    db.exec(`
      DELETE FROM activity_logs;
      DELETE FROM claims;
      DELETE FROM listings;
      DELETE FROM ngos;
      DELETE FROM restaurants;
    `);
    seedDatabase();
    return sendJSON(res, 200, { success: true, message: 'Platform demo data successfully reset and re-seeded' });
  }

  return sendJSON(res, 404, { error: `Endpoint not found: ${method} ${pathname}` });
}

// Static File Server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(PUBLIC_DIR, relativePath);

  // Guard against directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for client side routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Internal Server Error');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

// Main HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (pathname.startsWith('/api/')) {
      await handleApiRequest(req, res, pathname, parsedUrl.searchParams);
    } else {
      serveStaticFile(req, res, pathname);
    }
  } catch (error) {
    console.error('Server error handling request:', error);
    sendJSON(res, 500, { error: 'Internal Server Error', message: error.message });
  }
});

// Boot up
initializeDatabase();

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  🍲 FoodBridge Platform Server is running!`);
  console.log(`  Local URL:   http://localhost:${PORT}`);
  console.log(`  Database:    ${DB_FILE} (SQLite native)`);
  console.log(`  All Entries: http://localhost:${PORT}/api/all-entries`);
  console.log(`====================================================`);
});
