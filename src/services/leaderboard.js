import { supabase } from './supabase';

/**
 * Fetches data from the 'lost_items' table and aggregates metrics per user.
 */
export const getLeaderboardData = async () => {
  try {
    // 1. Query the exact table and column found in your Dashboard.jsx file
    const { data: items, error } = await supabase
      .from('lost_items') 
      .select('user_id'); // Using user_id based on your dashboard query snippet

    if (error) {
      console.error('Supabase query error:', error.message);
      return [];
    }

    if (!items || items.length === 0) {
      return [];
    }

    // 2. Group items by user_id and count how many entries they have
    const userCounts = items.reduce((accumulator, item) => {
      const id = item.user_id;
      
      // Default fallback name for prototype view
      const name = id ? `User ${id.substring(0, 5)}...` : 'Anonymous';

      if (!id) return accumulator;

      if (!accumulator[id]) {
        accumulator[id] = {
          id: id,
          name: name,
          itemsFound: 0,
        };
      }

      accumulator[id].itemsFound += 1;
      return accumulator;
    }, {});

    // 3. Convert grouped objects to array and sort by highest items found descending
    return Object.values(userCounts).sort((a, b) => b.itemsFound - a.itemsFound);
  } catch (err) {
    console.error('Unexpected error fetching leaderboard:', err);
    return [];
  }
}