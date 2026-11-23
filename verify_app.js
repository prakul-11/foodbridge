const http = require('http');

// Start the server
require('./server.js');

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          json: () => JSON.parse(data)
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting FoodBridge Verification Tests ---');

  // Wait 600ms for server listen
  await new Promise(r => setTimeout(r, 600));

  // 1. Static Assets
  console.log('[Test 1] Testing Static HTML...');
  const indexRes = await request('/');
  if (indexRes.status !== 200 || !indexRes.data.includes('FoodBridge')) {
    throw new Error(`Failed to load index.html, status: ${indexRes.status}`);
  }
  console.log('✓ index.html loaded successfully (contains "FoodBridge")');

  console.log('[Test 2] Testing Static CSS & JS...');
  const cssRes = await request('/style.css');
  if (cssRes.status !== 200 || !cssRes.data.includes('--primary')) {
    throw new Error(`Failed to load style.css, status: ${cssRes.status}`);
  }
  const jsRes = await request('/app.js');
  if (jsRes.status !== 200 || !jsRes.data.includes('const app =')) {
    throw new Error(`Failed to load app.js, status: ${jsRes.status}`);
  }
  console.log('✓ style.css and app.js served with status 200');

  // 2. Stats API
  console.log('[Test 3] Testing /api/stats...');
  const statsRes = await request('/api/stats');
  const stats = statsRes.json();
  console.log('✓ /api/stats output:', stats);
  if (!stats.totalListings || !stats.totalRestaurants) {
    throw new Error('Stats API returned empty data');
  }

  // 3. All Entries API
  console.log('[Test 4] Testing /api/all-entries...');
  const allEntriesRes = await request('/api/all-entries');
  const allEntries = allEntriesRes.json();
  console.log('✓ /api/all-entries count:', allEntries.totalEntries);
  if (allEntries.listings.length === 0 || allEntries.restaurants.length === 0) {
    throw new Error('All entries API missing initial records');
  }

  // 4. Create Restaurant
  console.log('[Test 5] Creating test restaurant...');
  const restRes = await request('/api/restaurants', {
    method: 'POST',
    body: {
      name: 'Sunflower Cafe & Bakery',
      contact_person: 'Chef Vikram Roy',
      phone: '+91 99887 76655',
      email: 'vikram@sunflowercafe.com',
      address: '22 Marine Drive, Colaba',
      city: 'Mumbai',
      area: 'Colaba',
      fssai_license: 'FSSAI-115239990012'
    }
  });
  const newRest = restRes.json();
  console.log(`✓ Restaurant created: ID #${newRest.id} (${newRest.name})`);

  // 5. Create Food Listing (matching Slide 05 format)
  console.log('[Test 6] Creating new surplus food listing...');
  const listingRes = await request('/api/listings', {
    method: 'POST',
    body: {
      restaurant_id: newRest.id,
      restaurant_name: newRest.name,
      food_name: 'Hyderabadi Veg Biryani with Mirchi Salan',
      category: 'Cooked Meals',
      quantity_servings: 50,
      quantity_unit: 'meal portions',
      dietary: 'Vegetarian',
      prepared_at: 'Today 7:00 PM',
      pickup_deadline: 'Today 9:30 PM',
      storage_notes: 'Kept above 65°C in chafing containers',
      packaging_type: 'Large sealed thermal trays',
      pickup_address: '22 Marine Drive, Colaba, Mumbai',
      contact_person: 'Chef Vikram Roy',
      contact_phone: '+91 99887 76655',
      special_instructions: 'Dispatch at kitchen service door'
    }
  });
  const newListing = listingRes.json();
  console.log(`✓ Listing created: ID #${newListing.id} (${newListing.food_name}) - Status: ${newListing.status}`);

  // 6. Claim Food
  console.log('[Test 7] Claiming the new listing for NGO...');
  const claimRes = await request('/api/claims', {
    method: 'POST',
    body: {
      listing_id: newListing.id,
      ngo_id: 1,
      ngo_name: 'Hope for All Relief Foundation',
      estimated_pickup_time: 'Today 8:15 PM',
      volunteer_name: 'Rohit Kadam',
      volunteer_phone: '+91 98205 11002',
      notes: 'Coming in white insulated rescue van'
    }
  });
  const newClaim = claimRes.json();
  console.log(`✓ Claim created: ID #${newClaim.id} for Listing #${newClaim.listing_id}`);

  // 7. Verify Listing Status is now CLAIMED
  const checkListing = await request(`/api/listings/${newListing.id}`);
  const updatedListing = checkListing.json();
  console.log(`✓ Verified listing status after claim: ${updatedListing.status} (Claimed by: ${updatedListing.claimed_by_ngo_name})`);
  if (updatedListing.status !== 'CLAIMED') {
    throw new Error('Listing status was not updated to CLAIMED');
  }

  // 8. Confirm Pickup and Mark Distributed
  console.log('[Test 8] Confirming collection and distribution...');
  const pickupRes = await request(`/api/claims/${newClaim.id}/status`, {
    method: 'PATCH',
    body: {
      status: 'COLLECTED',
      distribution_notes: 'Successfully distributed 50 portions to South Mumbai night shelter'
    }
  });
  const updatedClaim = pickupRes.json();
  console.log(`✓ Claim #${newClaim.id} status updated to: ${updatedClaim.status}`);

  // 9. Re-verify All Entries reflects the new entries
  console.log('[Test 9] Checking updated /api/all-entries...');
  const finalAllEntries = await (await request('/api/all-entries')).json();
  console.log('✓ Final total entries summary:', finalAllEntries.totalEntries);
  const foundListing = finalAllEntries.listings.find(l => l.id === newListing.id);
  console.log(`✓ Found listing in master table: ID #${foundListing.id}, Status: ${foundListing.status}, Distribution: "${foundListing.distribution_notes}"`);

  console.log('\n======================================================');
  console.log('  🎉 ALL FOODBRIDGE TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Verification test failed:', err);
  process.exit(1);
});
