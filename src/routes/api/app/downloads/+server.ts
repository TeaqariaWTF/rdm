import { PUBLIC_BASE_URI } from '$env/static/public';
import type { DownloadsResponse, APIResponse } from '$lib/app/types';
import Fuse from 'fuse.js';

const fuseOptions = {
	// isCaseSensitive: false,
	// includeScore: true,
	shouldSort: true,
	// includeMatches: true,
	// findAllMatches: false,
	// minMatchCharLength: 1,
	// location: 0,
	// distance: 100,
	// useExtendedSearch: false,
	// ignoreLocation: false,
	// ignoreFieldNorm: false,
	// fieldNormWeight: 1,
	// threshold: 0.6,
	keys: ['id', 'filename']
};

export const GET = async ({ url, fetch, cookies }) => {
	let accessToken: string | undefined = cookies.get('accessToken');
	const refreshToken: string | undefined = cookies.get('refreshToken');
	const limit: number = Number(url.searchParams.get('limit')) || 10;
	const page: number = Number(url.searchParams.get('page')) || 1;
	const query: string | null = url.searchParams.get('query');

	try {
		if (!refreshToken) {
			return new Response(
				JSON.stringify({
					status: 401,
					success: false,
					error: 'Unauthorized. No access token or refresh token.'
				} as APIResponse),
				{
					status: 401,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		}

		if (!accessToken) {
			const res = await fetch('/api/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			const data: APIResponse = await res.json();
			if (!data.success) {
				return new Response(
					JSON.stringify({
						status: 401,
						success: false,
						error: 'Unauthorized. No access token or refresh token.'
					} as APIResponse),
					{
						status: 401,
						headers: {
							'content-type': 'application/json'
						}
					}
				);
			}

			accessToken = cookies.get('accessToken');
		}

		if (limit <= 0 || limit > 2500) {
			return new Response(
				JSON.stringify({
					status: 400,
					success: false,
					error: 'Bad Request. Limit must be between 1 and 2500'
				} as APIResponse),
				{
					status: 400,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		}

		if (page <= 0) {
			return new Response(
				JSON.stringify({
					status: 400,
					success: false,
					error: 'Bad Request. Page must be greater than 0'
				} as APIResponse),
				{
					status: 400,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		}

		if (!query) {
			const res = await fetch(`${PUBLIC_BASE_URI}/downloads?limit=${limit}&page=${page}`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json'
				}
			});
			if (!res.ok)
				return new Response(
					JSON.stringify({
						success: false,
						status: res.status,
						error: res.statusText
					} as APIResponse),
					{ status: res.status, headers: { 'Content-Type': 'application/json' } }
				);

			const totalCount: string | null = res.headers.get('X-Total-Count');
			const downloads = await res.json();

			return new Response(
				JSON.stringify({
					success: true,
					status: 200,
					data: downloads,
					totalCount: totalCount,
					limit: limit,
					page: page
				} as APIResponse<DownloadsResponse[]>),
				{
					status: 200,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		} else {
			const queryLimit: number = 2500;
			let queryPage: number = 1;
			// TODO: add type
			let queryData: any[] = [];
			let queryTotalCount: string | null = null;

			while (true) {
				console.log(`Querying page ${queryPage}...`);

				const tempData = await fetch(
					`${PUBLIC_BASE_URI}/downloads?limit=${queryLimit}&page=${queryPage}`,
					{
						method: 'GET',
						headers: {
							Authorization: `Bearer ${accessToken}`,
							'Content-Type': 'application/json'
						}
					}
				);

				if (!tempData.ok)
					return new Response(
						JSON.stringify({
							success: false,
							status: tempData.status,
							error: tempData.statusText
						} as APIResponse),
						{ status: tempData.status, headers: { 'Content-Type': 'application/json' } }
					);

				if (tempData.status === 204) {
					console.log('No more data to query.');
					break;
				}

				try {
					const tempJsonData: DownloadsResponse[] = await tempData.json();
					if (tempJsonData.length === 0) {
						console.log('No more data to query.');
						break;
					}

					queryData = queryData.concat(tempJsonData);
					queryTotalCount = tempData.headers.get('X-Total-Count');
					queryPage++;
				} catch (e) {
					console.log(e);
					break;
				}
			}

			const fuse = new Fuse(queryData, fuseOptions);
			queryData = fuse.search(query);
			queryData = queryData.map((result) => result.item);

			return new Response(
				JSON.stringify({
					status: 200,
					success: true,
					data: queryData,
					totalCount: queryTotalCount,
					limit: queryLimit,
					page: queryPage,
					query: query
				} as APIResponse<DownloadsResponse[]>),
				{
					status: 200,
					headers: {
						'content-type': 'application/json'
					}
				}
			);
		}
	} catch (error) {
		return new Response(
			JSON.stringify({ success: false, status: 500, error: error } as APIResponse),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
