import { objectToSearchParams } from './skSearchParams.js';

// Define the types for the route configuration
type ValidationFunction<T> = (input: T) => T;

interface RouteDetails {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	paramsValidation?: ValidationFunction<any>;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	searchParamsValidation?: ValidationFunction<any>;
}

type ParamsType<Details extends RouteDetails> =
	Details['paramsValidation'] extends ValidationFunction<infer T> ? T : undefined;
type SearchParamsType<Details extends RouteDetails> =
	Details['searchParamsValidation'] extends ValidationFunction<infer T> ? T : undefined;

type ValidatedParamsType<Details extends RouteDetails> = Details['paramsValidation'] extends (
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	...args: any[]
) => infer R
	? R
	: undefined;
type ValidatedSearchParamsType<Details extends RouteDetails> =
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	Details['searchParamsValidation'] extends (...args: any[]) => infer R ? R : undefined;

export interface RouteConfig {
	[address: string]: RouteDetails;
}

// Define the generateURL function
type Input<Config, Address extends keyof Config> = {
	address: Address;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
} & (Config[Address] extends { paramsValidation: ValidationFunction<any> }
	? { paramsValue: ParamsType<Config[Address]> }
	: // eslint-disable-next-line @typescript-eslint/ban-types
	  {}) &
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(Config[Address] extends { searchParamsValidation: ValidationFunction<any> }
		? { searchParamsValue: SearchParamsType<Config[Address]> }
		: // eslint-disable-next-line @typescript-eslint/ban-types
		  {});

// Higher-order function
export function createURLGenerator<Config extends RouteConfig>({
	errorURL,
	config
}: {
	errorURL: string;
	config: Config;
}) {
	const urlGenerator = <Address extends keyof Config>(
		input: Input<Config, Address>
	): {
		address: Address;
		url: string;
		error: boolean;
		params?: ValidatedParamsType<Config[Address]>;
		searchParams?: ValidatedSearchParamsType<Config[Address]>;
	} => {
		try {
			const routeDetails = config[input.address];

			let validatedParams;
			if (
				'paramsValidation' in routeDetails &&
				'paramsValue' in input &&
				routeDetails.paramsValidation
			) {
				validatedParams = routeDetails.paramsValidation(input.paramsValue);
			}

			let validatedSearchParams;
			if (
				'searchParamsValidation' in routeDetails &&
				'searchParamsValue' in input &&
				routeDetails.searchParamsValidation
			) {
				validatedSearchParams = routeDetails.searchParamsValidation(input.searchParamsValue);
			}

			// Construct the URL
			let url = input.address as string;

			// Replace "/[x]" with the corresponding value from validatedParams
			if (validatedParams) {
				for (const key in validatedParams) {
					const regex = new RegExp(`/\\[${key}\\]`, 'g');
					url = url.replace(regex, `/${validatedParams[key]}`);
				}
			}

			// Remove all instances of "/(...)"
			url = url.replace(/\/\([^)]+\)/g, '');

			// Append search params to the URL
			if (validatedSearchParams) {
				const searchParams = objectToSearchParams(validatedSearchParams);
				url += `?${searchParams.toString()}`;
			}

			return {
				address: input.address,
				params: validatedParams,
				searchParams: validatedSearchParams,
				url,
				error: false
			};
		} catch {
			const errorMessage = { message: 'Error generating URL' };
			return {
				address: input.address,
				url: `${errorURL}?${objectToSearchParams(errorMessage)}`,
				error: true
			};
		}
	};
	return { urlGenerator };
}
