export interface CreateNotification {
    userId: number
    type: 'NEW_COMMENT' | 'POST_LIKED'
    message: string
}