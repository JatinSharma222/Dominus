import { portfolioTool, executePortfolioRead } from "./portfolio"
import { jupiterSwapTool, executeJupiterSwap } from "./jupiter"
import { kaminoDepositTool, executeKaminoDeposit } from "./kamino"
import { jitoStakeTool, executeJitoStake } from "./jito"

export const allTools = {
  get_portfolio: {
    ...portfolioTool,
    execute: executePortfolioRead,
  },
  swap_tokens: {
    ...jupiterSwapTool,
    execute: executeJupiterSwap,
  },
  deposit_for_yield: {
    ...kaminoDepositTool,
    execute: executeKaminoDeposit,
  },
  stake_sol: {
    ...jitoStakeTool,
    execute: executeJitoStake,
  },
}