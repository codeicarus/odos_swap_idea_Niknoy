import { routes } from './routes.js';
import { chain_ids } from './chain_ids.js';
import * as fs from 'fs';
import BigNumber from "bignumber.js";
import _ from 'lodash';

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

(async () => {
    for (const route of routes) {
        let { from_chain, to_chain, amount, input_token, output_token } = route;
        const from_chain_id = Number(chain_ids[from_chain]);

        const from_token_map = JSON.parse(fs.readFileSync(`./token_infos/${from_chain}.json`))["tokenMap"];

        let from_input_token_address, from_output_token_address;
        let from_input_token_decimals, from_output_token_decimals;

        for (let token_address in from_token_map) {
            let from_token_info = from_token_map[token_address];

            if (input_token.toLowerCase() === from_token_info["symbol"].toLowerCase()) {
                from_input_token_address = token_address;
                from_input_token_decimals = from_token_info["decimals"];
            }

            if (output_token.toLowerCase() === from_token_info["symbol"].toLowerCase()) {
                from_output_token_address = token_address;
                from_output_token_decimals = from_token_info["decimals"];
            }
        }

        const gas_price = 20;
        const input_token_amount = BigNumber(amount).multipliedBy(BigNumber(10).pow(from_input_token_decimals));

        const proportion = 1;
        const referralCode = 0;
        const slippageLimitPercent = 0.3;
        const disableRFQs = false
        const sourceBlacklist = [];
        const sourceWhitelist = [];
        const userAddr = "0x47E2D28169738039755586743E2dfCF3bd643f86";
        let first_swap_schema = {};

        first_swap_schema["chainId"] = from_chain_id;
        first_swap_schema["compact"] = true;
        first_swap_schema["gasPrice"] = gas_price;
        first_swap_schema["inputTokens"] = [
            {
                "amount": input_token_amount.toString(),
                "tokenAddress": from_input_token_address,
            }
        ]
        first_swap_schema["outputTokens"] = [
            {
                "proportion": proportion,
                "tokenAddress": from_output_token_address
            }
        ]
        first_swap_schema["referralCode"] = referralCode;
        first_swap_schema["slippageLimitPercent"] = slippageLimitPercent;
        first_swap_schema["disableRFQs"] = disableRFQs;
        first_swap_schema["sourceBlacklist"] = sourceBlacklist;
        first_swap_schema["sourceWhitelist"] = sourceWhitelist;
        first_swap_schema["userAddr"] = userAddr;

        await sleep(300);

        const first_swap_response = await fetch('https://api.odos.xyz/sor/quote/v2',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(first_swap_schema),
            }
        );

        let from_output_token_amount = BigNumber(0);

        if (first_swap_response.status === 200) {
            const first_quote = await first_swap_response.json();

            from_output_token_amount = BigNumber(first_quote.outAmounts[0]).dividedBy(BigNumber(10).pow(from_output_token_decimals))
            // console.log(from_output_token_amount);
            // handle first_quote first_swap_response data
        } else {
            console.error('Error in Quote:', first_swap_response);
            // handle first_quote failure cases
        }

        for (let i = 0; i < to_chain.length; i++) {
            let to_input_token_address, to_output_token_address;
            let to_input_token_decimals, to_output_token_decimals;

            const to_chain_id = Number(chain_ids[to_chain[i]]);
            const to_chain_name = to_chain[i];
            if (to_chain_name === "Mantle") { const mantle_input_token = "WETH"; input_token = mantle_input_token }
            else if (to_chain_name === "Polygon") { const polygon_input_token = "WETH"; input_token = polygon_input_token }
            else if (to_chain_name === "Avalanche") { const avalanche_input_token = "aAvaWETH"; input_token = avalanche_input_token }
            else { input_token = route.input_token }

            if (to_chain_name === "Linea") { const linea_output_token = "USDC.e"; output_token = linea_output_token }
            else { output_token = route.output_token }
            const to_token_map = JSON.parse(fs.readFileSync(`./token_infos/${to_chain_name}.json`))["tokenMap"];
            for (let to_token_address in to_token_map) {
                let to_token_info = to_token_map[to_token_address];

                if (output_token.toLowerCase() === to_token_info["symbol"].toLowerCase()) {
                    to_input_token_address = to_token_address;
                    // console.log(to_input_token_address);
                    to_input_token_decimals = to_token_info["decimals"];
                    // console.log(to_input_token_decimals);
                }

                if (input_token.toLowerCase() === to_token_info["symbol"].toLowerCase()) {
                    to_output_token_address = to_token_address;
                    // console.log(to_output_token_address);
                    to_output_token_decimals = to_token_info["decimals"];
                    // console.log(to_output_token_decimals);
                }
            }

            const output_token_amount = BigNumber(from_output_token_amount).multipliedBy(BigNumber(10).pow(to_input_token_decimals));
            // console.log(output_token_amount.toFixed(0));

            let second_swap_schema = {};
            second_swap_schema["chainId"] = to_chain_id;
            second_swap_schema["compact"] = true;
            second_swap_schema["gasPrice"] = gas_price;
            second_swap_schema["inputTokens"] = [
                {
                    "amount": output_token_amount.toFixed(0),
                    "tokenAddress": to_input_token_address,
                }
            ]
            second_swap_schema["outputTokens"] = [
                {
                    "proportion": proportion,
                    "tokenAddress": to_output_token_address,
                }
            ]
            second_swap_schema["referralCode"] = referralCode;
            second_swap_schema["slippageLimitPercent"] = slippageLimitPercent;
            second_swap_schema["sourceBlacklist"] = sourceBlacklist;
            second_swap_schema["sourceWhitelist"] = sourceWhitelist;
            second_swap_schema["userAddr"] = userAddr;

            await sleep(600);

            const second_swap_response = await fetch('https://api.odos.xyz/sor/quote/v2',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(second_swap_schema),
                }
            );

            let to_output_token_amount = BigNumber(0);

            if (second_swap_response.status === 200) {
                const second_quote = await second_swap_response.json();

                to_output_token_amount = BigNumber(second_quote.outAmounts[0]).dividedBy(BigNumber(10).pow(to_output_token_decimals));

            } else {
                console.error('Error in Quote:', second_swap_response);
                // handle second_quote failure cases
            }

            function financial(x) {
                return Number.parseFloat(x).toFixed(4);
            }
            // if (i === 0) {
            //     console.log(from_chain, ":", amount, input_token, "=>", financial(from_output_token_amount), output_token, "\n");
            // }
            // console.log("              ", to_chain[i], ":", financial(from_output_token_amount), output_token, "=>", financial(to_output_token_amount), input_token, "\n");
            let token_amount_color = "color:yellow";

            console.log("\x1b[36m", from_chain, "\x1b[37m", "=>", "\x1b[36m", to_chain[i], "\n", "\x1b[33m", amount, "\x1b[32m", input_token, "\x1b[37m", "=>", "\x1b[33m", financial(from_output_token_amount), "\x1b[32m", output_token, "\n", "\x1b[33m", financial(from_output_token_amount), "\x1b[32m", output_token, "\x1b[37m", "=>", "\x1b[33m", financial(to_output_token_amount), "\x1b[32m", input_token, "\n", "\x1b[37m", "-------------------------------------------------------------------------------");
        }

    }
})();

