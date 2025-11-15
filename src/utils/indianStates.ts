/**
 * Indian States and Union Territories mapping
 * Maps ISO 3166-2:IN codes to state names
 */
export const indianStates: Record<string, string> = {
    'IN-AN': 'Andaman and Nicobar Islands',
    'IN-AP': 'Andhra Pradesh',
    'IN-AR': 'Arunachal Pradesh',
    'IN-AS': 'Assam',
    'IN-BR': 'Bihar',
    'IN-CH': 'Chandigarh',
    'IN-CT': 'Chhattisgarh',
    'IN-DH': 'Dadra and Nagar Haveli and Daman and Diu',
    'IN-DL': 'Delhi',
    'IN-GA': 'Goa',
    'IN-GJ': 'Gujarat',
    'IN-HR': 'Haryana',
    'IN-HP': 'Himachal Pradesh',
    'IN-JK': 'Jammu and Kashmir',
    'IN-JH': 'Jharkhand',
    'IN-KA': 'Karnataka',
    'IN-KL': 'Kerala',
    'IN-LA': 'Ladakh',
    'IN-LD': 'Lakshadweep',
    'IN-MP': 'Madhya Pradesh',
    'IN-MH': 'Maharashtra',
    'IN-MN': 'Manipur',
    'IN-ML': 'Meghalaya',
    'IN-MZ': 'Mizoram',
    'IN-NL': 'Nagaland',
    'IN-OR': 'Odisha',
    'IN-PY': 'Puducherry',
    'IN-PB': 'Punjab',
    'IN-RJ': 'Rajasthan',
    'IN-SK': 'Sikkim',
    'IN-TN': 'Tamil Nadu',
    'IN-TG': 'Telangana',
    'IN-TR': 'Tripura',
    'IN-UP': 'Uttar Pradesh',
    'IN-UT': 'Uttarakhand',
    'IN-WB': 'West Bengal'
};

/**
 * Get Indian state name from region code
 * @param regionCode - ISO 3166-2:IN region code (e.g., "IN-MH", "MH")
 * @returns State name or null if not found
 */
export function getIndianStateName(regionCode: string | null | undefined): string | null {
    if (!regionCode) return null;

    // Normalize the code
    const normalizedCode = regionCode.toUpperCase();
    const fullCode = normalizedCode.startsWith('IN-') ? normalizedCode : `IN-${normalizedCode}`;

    return indianStates[fullCode] || null;
}

/**
 * Check if a region code is an Indian state
 * @param regionCode - Region code to check
 * @returns true if it's an Indian state code
 */
export function isIndianState(regionCode: string | null | undefined): boolean {
    if (!regionCode) return false;

    const normalizedCode = regionCode.toUpperCase();
    const fullCode = normalizedCode.startsWith('IN-') ? normalizedCode : `IN-${normalizedCode}`;

    return fullCode in indianStates;
}
