import { supabase } from './supabase';

/**
 * Fetches raw data from the 'lost_items' table.
 */
export const getLeaderboardData = async () => {
  try {
    // 1. Fetch only the user_id column from lost_items to prevent table join crashes
    const { data: items, error } = await supabase
      .from('lost_items') 
      .select('user_id');

    if (error) {
      console.error('Supabase query error:', error.message);
      return [];
    }

    if (!items || items.length === 0) {
      return [];
    }

    // 2. Count the total items reported per unique identifier string
    const userCounts = items.reduce((accumulator, item) => {
      const id = item.user_id;
      if (!id) return accumulator;

      if (!accumulator[id]) {
        accumulator[id] = {
          id: id,
          itemsFound: 0,
        };
      }

      accumulator[id].itemsFound += 1;
      return accumulator;
    }, {});

    // 3. Convert grouped objects to array and sort descending (highest first)
    return Object.values(userCounts).sort((a, b) => b.itemsFound - a.itemsFound);
  } catch (err) {
    console.error('Unexpected error fetching leaderboard:', err);
    return [];
  }
};
