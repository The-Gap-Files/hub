export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'Output ID is required'
    })
  }

  try {
    // Atualizar status para CANCELLED
    const output = await prisma.output.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    })

    // Registrar log de cancelamento
    await prisma.pipelineExecution.create({
      data: {
        outputId: id,
        step: 'cancel',
        status: 'completed',
        message: 'Output cancelled by user'
      }
    })

    return {
      success: true,
      output
    }
  } catch (error: any) {
    console.error('[API] Error cancelling output:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to cancel output'
    })
  }
})
