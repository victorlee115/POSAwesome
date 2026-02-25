/**
 * Utility functions for responsive item card layout.
 */

/**
 * Calculates the number of columns based on container width.
 */
export const getCardColumns = (width: number): number => {
	if (width <= 420) {
		return 1;
	}
	if (width <= 560) {
		return 2;
	}
	if (width <= 980) {
		return 3;
	}
	return 4;
};

/**
 * Calculates the gap between cards based on container width.
 */
export const getCardGap = (width: number): number => {
	if (width <= 720) {
		return 8;
	}
	if (width <= 1080) {
		return 10;
	}
	return 12;
};

/**
 * Calculates the padding for the card container based on container width.
 */
export const getCardPadding = (width: number): number => {
	if (width <= 720) {
		return 8;
	}
	if (width <= 1080) {
		return 10;
	}
	return 12;
};
